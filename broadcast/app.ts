import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApi } from 'aws-sdk';
import Logger from './utils/Logger';
import * as AWS from 'aws-sdk';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const tableName = process.env.CONNECTION_LOG_TABLE;
        if (!tableName) {
            throw new Error("No CONNECTION_LOG_TABLE name found in environment variables.");
        }

        let activeConnectionRecords: AWS.DynamoDB.ItemList;
        let broadcastMessage: string;
        try {
            Logger.appendLog(`Passed in value: ${JSON.stringify(event)}`);
            if (event.body) {
                broadcastMessage = JSON.parse(event.body).message
            } else {
                throw new Error(`Event property \"body\" was not present in the request. Will not broadcast. Event object details:\n${JSON.stringify(event)}`);
            }

            Logger.appendLog(broadcastMessage);
        } catch (error: any) {
            Logger.appendError(error);
            throw new Error(`Could not parse message passed into broadcaster. Message:\n${JSON.stringify(event)}`);
        }

        try {
            const dynamoDB: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient();
            const scanResult: AWS.DynamoDB.ScanOutput = await dynamoDB
                .scan({
                    TableName: tableName
                })
                .promise();

            if (scanResult.Items) {
                activeConnectionRecords = scanResult.Items;
            } else {
                throw new Error("Scan result property \"Items\" was not present in the response.");
            }
        } catch (error: any) {
            Logger.appendError(error);
            throw new Error(`Could not obtain active connections from ${tableName}.`);
        }

        try {
            const apigatewaymanagementapi = new ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_API_ENDPOINT, });
            Logger.appendLog("Api gateway instantiated.");
    
            let broadcastPromises: (Promise<{$response: AWS.Response<{}, AWS.AWSError>}> | Promise<void>)[] = activeConnectionRecords.map(
                async (activeConnection: AWS.DynamoDB.AttributeMap) => {
                    try {
                        await apigatewaymanagementapi.postToConnection({ 
                            ConnectionId: activeConnection.connection_id as string, 
                            Data: JSON.stringify(broadcastMessage)
                        }).promise()
                    } catch (error: any) {
                        Logger.appendError(error);
                        Logger.appendLog(`Could not send broadcast to [${activeConnection.connection_id}]. Skipping...`)
                    }
                }
            );

            await Promise.all(broadcastPromises);
            
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
