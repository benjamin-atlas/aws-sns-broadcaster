import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Logger from './utils/Logger';
import * as AWS from 'aws-sdk';

export default async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        Logger.appendLog(`Disconnect happens. Connection ID: ${event.requestContext.connectionId ?? ""}`);

        const tableName = process.env.CONNECTION_LOG_TABLE;
        try {
            const dynamoDB: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient();

            if (event.requestContext.connectionId) {

                if (!tableName) {
                    throw new Error("No CONNECTION_LOG_TABLE name found in environment variables.");
                }

                const subsToDelete: any[] = (await dynamoDB.scan({
                    TableName: tableName,
                    FilterExpression: 'connection_id = :connectionId',
                    ExpressionAttributeValues: {
                        ':connectionId': event.requestContext.connectionId,
                    },
                }).promise()).Items ?? [];

                if (subsToDelete.length === 0) {
                    Logger.appendLog(`No subscriptions found for connection ID [${event.requestContext.connectionId}].`);

                    return {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: '',
                        }),
                    };
                }

                Promise.all(subsToDelete.map(async (subToDelete: any) => {
                    Logger.appendLog(`Removing subscription [${subToDelete.connection_id}] from ${tableName}. Sub object: ${JSON.stringify(subToDelete)}`);
                    try {
                        await dynamoDB.delete({
                            TableName: tableName,
                            Key: { connection_id: subToDelete.connection_id }
                        }).promise();
                    } catch (error: any) {
                        Logger.appendError(error);
                        Logger.appendLog(`Could not remove subscription [${subToDelete.connection_id}]. Skipping...`);
                    }
                }));
            } else {
                Logger.appendLog(`No connection ID passed. Cannot remove from ${tableName}.`)
            }
        } catch (error: any) {
            Logger.appendError(error);
            throw new Error(`Could not remove connection [${event.requestContext.connectionId ?? ""}] in ${tableName}.`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: '',
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'An error has occured',
            }),
        };
    }
};
