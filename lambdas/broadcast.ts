import { APIGatewayProxyResult, SQSEvent } from 'aws-lambda';
import { ApiGatewayManagementApi } from 'aws-sdk';
import Logger from './utils/Logger';
import * as AWS from 'aws-sdk';

export default async (event: SQSEvent): Promise<APIGatewayProxyResult> => {
    try {
        const tableName = process.env.CONNECTION_LOG_TABLE;
        if (!tableName) {
            throw new Error("No CONNECTION_LOG_TABLE name found in environment variables.");
        }

        let broadcastMessages: any[];
        try {
            Logger.appendLog(`Passed in value: ${JSON.stringify(event)}`);
            if (event.Records && event.Records.length > 0) {
                broadcastMessages = event.Records.map(record => JSON.parse(JSON.parse(record.body)?.Message));
            } else {
                throw new Error(`Event property [\"Records\"] was not present in the SNS event or was empty. Will not broadcast. Event object details:\n${JSON.stringify(event)}`);
            }
        } catch (error: any) {
            Logger.appendError(error);
            throw new Error(`Could not parse message passed into broadcaster. Message:\n${JSON.stringify(event)}`);
        }

        try {
            const apigatewaymanagementapi = new ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_API_ENDPOINT, });
            Logger.appendLog("Api gateway instantiated.");

            for (let broadcastMessage of broadcastMessages) {
                const dynamoDB: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient();
                const tableName = 'broadcast-connection-log';

                try {
                    const params: AWS.DynamoDB.DocumentClient.ScanInput = {
                        TableName: tableName,
                        FilterExpression: 'task_id = :taskId',
                        ExpressionAttributeValues: {
                            ':taskId': broadcastMessage.task_id,
                        },
                    };
    
                    let taskSubscriptionRecords: AWS.DynamoDB.DocumentClient.ItemList | undefined = (await dynamoDB.scan(params).promise())?.Items;

                    if (!taskSubscriptionRecords || taskSubscriptionRecords.length === 0) {
                        Logger.appendDebugLog(`No task subscription records found for task id [${broadcastMessage.task_id}]. Message will not be broadcast.`);
                        continue;
                    }

                    let broadcastPromises: (Promise<{$response: AWS.Response<{}, AWS.AWSError>}> | Promise<void>)[] = taskSubscriptionRecords.map(
                        async (activeConnection: AWS.DynamoDB.AttributeMap) => {
                            try {
                                await apigatewaymanagementapi.postToConnection({ 
                                    ConnectionId: activeConnection.connection_id as string, 
                                    Data: JSON.stringify(broadcastMessage.message)
                                }).promise()
                            } catch (error: any) {
                                Logger.appendError(error);
                                Logger.appendLog(`Could not send broadcast to [${activeConnection.connection_id}]. Skipping...`)
                            }
                        }
                    );

                    await Promise.all(broadcastPromises);
                } catch (error: any) {
                    Logger.appendError(error);
                    throw new Error(`An error occured querying table ${tableName} for task id [${broadcastMessage.task_id}].`);
                }
            }
            
            Logger.appendLog("All messages sent.");
        } catch (error: any) {
            Logger.appendError(error);
            throw new Error('Could not broadcast messages to clients.');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: '',
            }),
        };
    } catch (error: any) {
        Logger.appendError(error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'An error has occured',
            }),
        };
    }
};
