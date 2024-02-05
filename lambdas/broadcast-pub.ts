import { APIGatewayEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

export default async (event: APIGatewayEvent): Promise<any> => {
    try {
        const sns = new AWS.SNS();
        const message = event.body;

        if (message) {
            const topicArn = process.env.SNS_TOPIC_ARN;

            if (!topicArn) {
                throw new Error('SNS_TOPIC_ARN environment variable not set');
            }

            const params: AWS.SNS.PublishInput = {
                Message: message,
                TopicArn: topicArn,
            };

            await sns.publish(params).promise();

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Success! Message published to SNS topic.',
                }),
            };
        }
      } catch (error) {
        console.error('Error publishing message:', error);
        throw error;
      }
};