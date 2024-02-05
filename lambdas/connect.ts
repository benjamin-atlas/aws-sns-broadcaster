import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Logger from './utils/Logger';

export default async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    Logger.appendLog(`Connect happens. Connection ID: ${event.requestContext.connectionId ?? ""}`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: '',
        }),
    };

};
