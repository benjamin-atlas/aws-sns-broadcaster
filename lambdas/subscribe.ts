import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Logger from './utils/Logger';
import * as AWS from 'aws-sdk';

export default async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      Logger.appendLog(`Subscribe happens. Passed in event body: ${event.body}`);
        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'No body was passed.',
                }),
            };
        }

        const connectionId = event.requestContext.connectionId;
        const taskId = JSON.parse(event.body)?.task_id;

        if (!taskId) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'No task_id was passed.',
                }),
            };
        }

        Logger.appendLog(`Connection ID: ${connectionId}, task_id: ${taskId}`);
        
        const tableName = process.env.CONNECTION_LOG_TABLE;
        if (!tableName) {
            throw new Error("No CONNECTION_LOG_TABLE name found in environment variables.");
        }

        try {
            const dynamoDB: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient();

            await dynamoDB
                .put({
                    TableName: tableName,
                    Item: {
                        connection_id: event.requestContext.connectionId,
                        task_id: taskId
                    },
                })
                .promise();
        } catch (error: any) {
            Logger.appendError(error);
            throw new Error(`Could not track subscription in ${tableName}.`);
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
