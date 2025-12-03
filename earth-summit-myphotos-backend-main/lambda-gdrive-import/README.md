# MyPhotos Google Drive Import - Lambda Function

This Lambda function processes Google Drive import jobs by:
1. Downloading files from Google Drive
2. Adding watermarks
3. Uploading to S3
4. Generating face embeddings
5. Calling Next.js API to save to database

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy your watermark logo:
```bash
cp ../public/gff_logo_white.png ./
```

3. Build the deployment package:
```bash
npm run build
```

This creates `function.zip` ready for Lambda upload.

## Deploy

Upload `function.zip` to AWS Lambda via console or CLI:

```bash
aws lambda update-function-code \
  --function-name myphotos-gdrive-import-processor \
  --zip-file fileb://function.zip
```

## Environment Variables

Set these in Lambda configuration:

- `API_BASE_URL` - Your Next.js app URL (e.g., https://yourdomain.com)
- `API_KEY` - API key for internal endpoints (same as in Next.js .env)
- `AWS_S3_BUCKET` - S3 bucket name
- `AWS_REGION` - AWS region
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI
- `EMBEDDING_SERVICE_URL` - Embedding service URL

## Lambda Configuration

- **Runtime**: Node.js 20.x
- **Handler**: index.handler
- **Architecture**: x86_64
- **Memory**: 1024 MB (for sharp image processing)
- **Timeout**: 300 seconds (5 minutes)
- **Execution Role**: Attach role with SQS and S3 permissions

## SQS Trigger

Configure SQS trigger with:
- **Batch size**: 10
- **Maximum concurrency**: 10
- **Report batch item failures**: Yes
