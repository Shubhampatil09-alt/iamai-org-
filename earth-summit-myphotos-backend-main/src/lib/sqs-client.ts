import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageBatchCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';
import type { SQSImportMessage } from '@/types/google-drive';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_SQS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SQS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL!;

export async function sendToQueue(message: SQSImportMessage) {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      jobId: {
        DataType: 'String',
        StringValue: message.jobId,
      },
    },
  });

  return sqsClient.send(command);
}

export async function sendBatchToQueue(messages: SQSImportMessage[]) {
  // SQS batch limit is 10 messages
  const batches: SQSImportMessage[][] = [];
  for (let i = 0; i < messages.length; i += 10) {
    batches.push(messages.slice(i, i + 10));
  }

  for (const batch of batches) {
    const command = new SendMessageBatchCommand({
      QueueUrl: QUEUE_URL,
      Entries: batch.map((msg, idx) => ({
        Id: `${idx}`,
        MessageBody: JSON.stringify(msg),
        MessageAttributes: {
          jobId: {
            DataType: 'String',
            StringValue: msg.jobId,
          },
        },
      })),
    });

    await sqsClient.send(command);
  }
}

export async function receiveMessages(maxMessages: number = 10) {
  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 20, // Long polling
    VisibilityTimeout: 300, // 5 minutes
    MessageAttributeNames: ['All'],
  });

  const response = await sqsClient.send(command);
  return response.Messages || [];
}

export async function deleteMessage(receiptHandle: string) {
  const command = new DeleteMessageCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,
  });

  return sqsClient.send(command);
}

export async function extendMessageVisibility(receiptHandle: string, visibilityTimeout: number) {
  const command = new ChangeMessageVisibilityCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,
    VisibilityTimeout: visibilityTimeout,
  });

  return sqsClient.send(command);
}
