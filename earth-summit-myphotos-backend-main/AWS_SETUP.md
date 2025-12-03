# AWS Configuration Guide for Google Drive Integration

This guide covers all AWS setup required for the Google Drive import feature.

## Overview

The architecture uses:
- **AWS SQS**: Message queue for import jobs
- **AWS Lambda**: Worker to process files from queue
- **AWS S3**: Storage for photos (already configured)
- **IAM**: Permissions for Lambda and SQS

---

## Step 1: Create SQS Queues

### 1.1 Main Queue

1. Go to AWS Console → SQS → **Create queue**
2. Configure:
   - **Name**: `myphotos-gdrive-imports`
   - **Type**: Standard
   - **Visibility timeout**: `300 seconds` (5 minutes)
   - **Message retention period**: `14 days` (336 hours)
   - **Receive message wait time**: `0 seconds`
   - **Maximum message size**: `256 KB`
   - **Delivery delay**: `0 seconds`

3. Under **Dead-letter queue**:
   - ✅ Enable
   - **Choose queue**: (will create in next step)
   - **Maximum receives**: `3`

4. Click **Create queue**

5. **Copy the Queue URL** - you'll need it for environment variables

Example: `https://sqs.ap-south-1.amazonaws.com/123456789012/myphotos-gdrive-imports`

### 1.2 Dead Letter Queue (DLQ)

1. Go to SQS → **Create queue**
2. Configure:
   - **Name**: `myphotos-gdrive-imports-dlq`
   - **Type**: Standard
   - **Visibility timeout**: `300 seconds`
   - **Message retention period**: `14 days`
   - **Other settings**: Default

3. Click **Create queue**

4. **Copy the Queue URL**

5. Go back to main queue → **Edit** → Configure DLQ:
   - Select `myphotos-gdrive-imports-dlq`
   - Maximum receives: `3`
   - Save

---

## Step 2: Create IAM Role for Lambda

### 2.1 Create Role

1. Go to AWS Console → IAM → Roles → **Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: Lambda
4. Click **Next**

### 2.2 Attach Managed Policies

Select these AWS managed policies:
- ✅ `AWSLambdaBasicExecutionRole` (for CloudWatch logs)

Click **Next**

### 2.3 Create Custom Inline Policy

1. Role name: `MyPhotosGDriveImportLambdaRole`
2. Click **Create role**
3. Find the role and click on it
4. Click **Add permissions** → **Create inline policy**
5. Switch to **JSON** tab
6. Paste this policy (replace placeholders):

```json
{
  "Version": "2012-01-17",
  "Statement": [
    {
      "Sid": "SQSPermissions",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility"
      ],
      "Resource": [
        "arn:aws:sqs:REGION:ACCOUNT_ID:myphotos-gdrive-imports",
        "arn:aws:sqs:REGION:ACCOUNT_ID:myphotos-gdrive-imports-dlq"
      ]
    },
    {
      "Sid": "S3Permissions",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

**Replace:**
- `REGION`: Your AWS region (e.g., `ap-south-1`)
- `ACCOUNT_ID`: Your AWS account ID (12-digit number)
- `YOUR_BUCKET_NAME`: Your S3 bucket name (e.g., `gff-myphotos`)

7. Policy name: `MyPhotosLambdaSQSS3Policy`
8. Click **Create policy**

---

## Step 3: Create Lambda Function

### 3.1 Create Function

1. Go to AWS Console → Lambda → **Create function**
2. Configure:
   - **Function name**: `myphotos-gdrive-import-processor`
   - **Runtime**: Node.js 20.x
   - **Architecture**: x86_64
   - **Execution role**: Use an existing role
   - **Existing role**: `MyPhotosGDriveImportLambdaRole`

3. Click **Create function**

### 3.2 Configure Function

#### General Configuration

1. Click **Configuration** → **General configuration** → **Edit**
2. Set:
   - **Memory**: `1024 MB` (for sharp image processing)
   - **Timeout**: `5 minutes` (300 seconds)
   - **Ephemeral storage**: `512 MB`

3. Click **Save**

#### Environment Variables

1. Click **Configuration** → **Environment variables** → **Edit**
2. Add these variables:

| Key | Value | Example |
|-----|-------|---------|
| `API_BASE_URL` | Your Next.js app URL | `https://yourdomain.com` |
| `API_KEY` | Your API key (from Next.js .env) | Same as in Next.js |
| `AWS_S3_BUCKET` | S3 bucket name | `gff-myphotos` |
| `AWS_REGION` | AWS region | `ap-south-1` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | OAuth redirect | `https://yourdomain.com/api/auth/google/callback` |
| `EMBEDDING_SERVICE_URL` | Embedding service URL | Your embedding service URL |

3. Click **Save**

### 3.3 Upload Code

#### Option A: Via Console

1. Build the Lambda package:
```bash
cd lambda-gdrive-import
npm install
cp ../public/gff_logo_white.png ./
npm run build
```

2. Go to Lambda → **Code** tab
3. Click **Upload from** → **.zip file**
4. Select `function.zip`
5. Click **Save**

#### Option B: Via AWS CLI

```bash
cd lambda-gdrive-import
npm run deploy
```

### 3.4 Add SQS Trigger

1. Go to Lambda function → **Configuration** → **Triggers**
2. Click **Add trigger**
3. Configure:
   - **Source**: SQS
   - **SQS queue**: `myphotos-gdrive-imports`
   - **Batch size**: `10`
   - **Batch window**: `0 seconds`
   - **Enabled**: ✅ Yes

4. **Advanced settings**:
   - **Report batch item failures**: ✅ Yes
   - **Maximum concurrency**: `10`
   - **Concurrent batches per shard**: `10`

5. Click **Add**

---

## Step 4: Google Cloud Console Setup

### 4.1 Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Project name: `MyPhotos` (or your choice)

### 4.2 Enable APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - ✅ Google Drive API
   - ✅ Google+ API (for user info)

### 4.3 Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. **Application type**: Web application
4. **Name**: `MyPhotos Web Client`
5. **Authorized redirect URIs**: Add:
   - `http://localhost:3000/api/auth/google/callback` (development)
   - `https://yourdomain.com/api/auth/google/callback` (production)

6. Click **Create**
7. **Copy Client ID and Client Secret** - save these securely

### 4.4 Configure OAuth Consent Screen

1. Go to **OAuth consent screen**
2. **User Type**: External
3. Fill required fields:
   - App name: `MyPhotos`
   - User support email: Your email
   - Developer contact: Your email

4. **Scopes**: Add:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`

5. **Test users**: Add your email for testing
6. Save and continue

---

## Step 5: Update Next.js Environment Variables

Add to your `.env` file:

```bash
# Google Drive OAuth
GOOGLE_CLIENT_ID="YOUR_CLIENT_ID_FROM_GOOGLE"
GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET_FROM_GOOGLE"
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/google/callback"

# AWS SQS
AWS_SQS_QUEUE_URL="https://sqs.ap-south-1.amazonaws.com/123456789012/myphotos-gdrive-imports"
AWS_SQS_DLQ_URL="https://sqs.ap-south-1.amazonaws.com/123456789012/myphotos-gdrive-imports-dlq"

# Encryption (generate new key)
ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Import settings
GDRIVE_IMPORT_BATCH_SIZE="10"
GDRIVE_API_DELAY_MS="100"
GDRIVE_MAX_RETRIES="3"
```

---

## Step 6: Run Database Migration

```bash
# Generate migration
npx prisma migrate dev --name add_google_drive_integration

# Apply migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

## Step 7: Install Dependencies

```bash
npm install
```

This installs:
- `@aws-sdk/client-sqs` - SQS client
- `crypto-js` - Encryption for tokens
- `googleapis` - Google Drive API
- And dev dependencies

---

## Step 8: Test the Setup

### 8.1 Test Google OAuth

1. Start your Next.js app:
```bash
npm run dev
```

2. Go to dashboard and click "Upload Photos"
3. Click "Google Drive" tab
4. Click "Connect Google Drive"
5. You should be redirected to Google OAuth
6. Grant permissions
7. You should see "Google Drive Connected ✓"

### 8.2 Test Import

1. Select a folder in Google Drive
2. Choose room and date
3. Click "Start Import from Google Drive"
4. You should see:
   - Success message
   - Job ID
   - Option to view progress

5. Check Lambda logs in CloudWatch:
   - Go to Lambda → Monitor → View logs in CloudWatch
   - You should see processing logs

6. Check SQS metrics:
   - Go to SQS → `myphotos-gdrive-imports`
   - Messages sent should be > 0
   - Messages in flight while processing

---

## Monitoring & Troubleshooting

### CloudWatch Logs

- **Lambda logs**: `/aws/lambda/myphotos-gdrive-import-processor`
- Look for errors, processing times, file counts

### SQS Metrics

- **Messages visible**: Files waiting to process
- **Messages in flight**: Files currently processing
- **Messages in DLQ**: Failed files after 3 retries

### Common Issues

**Lambda timeout:**
- Increase timeout in Lambda configuration
- Check embedding service response time

**SQS messages not processing:**
- Verify Lambda trigger is enabled
- Check IAM permissions
- Look at Lambda error logs

**Google Drive token expired:**
- The refresh token should auto-renew
- Check encryption key is correct
- Verify Google OAuth consent screen approved

**No faces detected:**
- This is expected for some photos
- They'll be skipped (not failed)

---

## Cost Estimation

For 10,000 photos:

- **SQS**: ~$0.01 (10k messages)
- **Lambda**: ~$1.00 (1000 invocations × 30s × 1GB)
- **S3**: ~$0.25/month (storage + PUT requests)
- **Total**: ~$1.50 per 10,000 photos

Very cost-effective for large-scale imports!

---

## Security Best Practices

1. **API Keys**: Use strong, randomly generated keys
2. **Encryption Key**: Never commit to git, use environment variables
3. **IAM Roles**: Follow least-privilege principle
4. **SQS**: Messages deleted after successful processing
5. **Google OAuth**: Keep client secrets secure
6. **Lambda**: No database credentials stored

---

## Next Steps

After configuration:

1. Test with small folder first (10-20 photos)
2. Monitor CloudWatch logs
3. Verify photos appear in database
4. Check face embeddings created
5. Scale up to larger folders
6. Monitor costs in AWS Billing

---

For issues, check:
- CloudWatch Logs for Lambda errors
- SQS DLQ for failed messages
- Next.js logs for API errors
- Database logs for SQL errors
