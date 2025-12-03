import { NextRequest, NextResponse } from 'next/server';
import { receiveMessages, deleteMessage } from '@/lib/sqs-client';
import { processImportFile } from '@/lib/import-worker';
import type { SQSImportMessage } from '@/types/google-drive';

// This endpoint is primarily for testing/manual processing
// In production, AWS Lambda handles all SQS message processing automatically

export async function POST(request: NextRequest) {
  try {
    // Verify API key for security
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const batchSize = parseInt(process.env.GDRIVE_IMPORT_BATCH_SIZE || '10');
    const messages = await receiveMessages(batchSize);

    if (messages.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No messages in queue' });
    }

    const results = await Promise.allSettled(
      messages.map(async (msg) => {
        if (!msg.Body || !msg.ReceiptHandle) {
          return { success: false, error: 'Invalid message' };
        }

        try {
          const messageData: SQSImportMessage = JSON.parse(msg.Body);
          const result = await processImportFile(messageData);

          // Delete message from queue if successful or final failure
          if (result.success || !result.shouldRetry) {
            await deleteMessage(msg.ReceiptHandle!);
          }

          return result;
        } catch (error) {
          console.error('Error processing message:', error);
          // Delete malformed messages
          await deleteMessage(msg.ReceiptHandle!);
          return { success: false, error: 'Processing failed' };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    return NextResponse.json({
      processed: messages.length,
      successful,
      failed,
    });
  } catch (error) {
    console.error('Worker error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker failed' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    worker: 'gdrive-import',
    message: 'Primary processing handled by AWS Lambda. This endpoint available for manual testing.'
  });
}
