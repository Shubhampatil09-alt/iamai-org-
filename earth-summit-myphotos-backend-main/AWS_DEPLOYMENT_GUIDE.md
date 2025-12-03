# Master AWS Deployment Guide for MyPhotos

This is the **complete, self-contained guide** to deploying the entire MyPhotos stack. No need to check other files.

## 📋 Prerequisites

1.  **Git Bash** (for Windows) or Terminal (Mac/Linux).
2.  **Docker Desktop** installed and running.
3.  **Node.js** installed.
4.  **AWS CLI** installed.

---

## 🔑 Step 0: Configure AWS CLI

Since you have your **Access Key ID** and **Secret Access Key**, configure your local machine to talk to AWS.

Open your terminal (Git Bash on Windows) and run:

```bash
aws configure
```

Enter your details:
-   **AWS Access Key ID**: `[Paste your key]`
-   **AWS Secret Access Key**: `[Paste your secret]`
-   **Default region name**: `ap-south-1` (or your preferred region)
-   **Default output format**: `json`

---

## ☁️ Step 1: Create Shared Infrastructure (S3 & SQS)

### 1.1 Create S3 Bucket (Photo Storage)
1.  Go to **AWS Console** > **S3** > **Create bucket**.
2.  **Bucket name**: `myphotos-production` (must be unique globally).
3.  **Region**: `ap-south-1`.
4.  **Block Public Access**: ✅ Block all public access (Enabled).
5.  Click **Create bucket**.

### 1.2 Create SQS Queues (For Import Service)
1.  Go to **AWS Console** > **SQS** > **Create queue**.
2.  **Main Queue**:
    -   Name: `myphotos-gdrive-imports`
    -   Type: **Standard**
    -   Visibility timeout: **5 minutes** (300 seconds)
    -   Click **Create queue**.
    -   **Copy the URL** (e.g., `https://sqs.ap-south-1.amazonaws.com/.../myphotos-gdrive-imports`).
3.  **Dead Letter Queue (DLQ)**:
    -   Create another queue named: `myphotos-gdrive-imports-dlq`
    -   Type: **Standard**
    -   Click **Create queue**.
    -   **Copy the URL**.
4.  **Link DLQ**:
    -   Go back to `myphotos-gdrive-imports`.
    -   Edit > **Dead-letter queue** > Enabled.
    -   Choose `myphotos-gdrive-imports-dlq`.
    -   Save.

---

## 🧠 Step 2: Deploy Embedding Service (Lambda)

This service runs as a Docker container on Lambda.

1.  Open your terminal in the project root.
2.  Navigate to the folder:
    ```bash
    cd embedding-service
    ```
3.  **Run the deployment script** (Use Git Bash on Windows):
    ```bash
    ./deploy-lambda.sh
    ```
    *This script will automatically:*
    -   Create an ECR repository.
    -   Build the Docker image.
    -   Push the image to AWS.
    -   Create/Update the Lambda function.
    -   **Generate a Function URL**.

4.  **⚠️ IMPORTANT**: The script will output a **Function URL** at the end (starts with `https://...lambda-url...`). **Copy this URL**.

---

## 🔄 Step 3: Deploy Import Service (Lambda)

This service processes files from the SQS queue.

### 3.1 Create IAM Role
1.  Go to **AWS Console** > **IAM** > **Roles** > **Create role**.
2.  **Trusted entity**: AWS Service > **Lambda**.
3.  **Permissions**: Click **Create inline policy** > **JSON** tab. Paste this:
    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "sqs:ReceiveMessage",
                    "sqs:DeleteMessage",
                    "sqs:GetQueueAttributes",
                    "s3:PutObject",
                    "s3:GetObject",
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                "Resource": "*"
            }
        ]
    }
    ```
4.  Name the policy: `MyPhotosImportPolicy`.
5.  Name the role: `MyPhotosGDriveImportLambdaRole`.
6.  Click **Create role**.

### 3.2 Deploy Code
1.  Navigate to the import folder:
    ```bash
    cd ../lambda-gdrive-import
    ```
2.  Deploy using the npm script:
    ```bash
    npm install
    npm run deploy
    ```
    *(If `npm run deploy` fails on Windows, you can zip the folder contents manually and upload `function.zip` to the Lambda console).*

### 3.3 Configure Lambda
1.  Go to **AWS Console** > **Lambda** > `myphotos-gdrive-import-processor`.
2.  **Configuration** > **Environment variables** > **Edit**:
    -   `AWS_S3_BUCKET`: `myphotos-production`
    -   `AWS_REGION`: `ap-south-1`
    -   `EMBEDDING_SERVICE_URL`: *(Paste the URL from Step 2)*
    -   `API_BASE_URL`: *(Your EC2 IP/Domain, you can update this later)*
3.  **Configuration** > **Triggers** > **Add trigger**:
    -   Select **SQS**.
    -   Queue: `myphotos-gdrive-imports`.
    -   Batch size: `10`.
    -   Click **Add**.

---

## 💻 Step 4: Deploy Main App (EC2)

Now we deploy the main application server.

### 4.1 Launch EC2 Instance
1.  **EC2 Console** > **Launch Instance**.
2.  **Name**: `MyPhotos-Server`.
3.  **OS**: Ubuntu 22.04 LTS.
4.  **Instance Type**: `t3.medium` (Minimum) or `t3.large`.
5.  **Key Pair**: Create new `myphotos-key`. **Save the .pem file**.
6.  **Security Group**: Allow SSH (22), HTTP (80), HTTPS (443).
7.  **Storage**: 50 GB gp3.
8.  Launch.

### 4.2 Setup Server
Open terminal where your `.pem` file is:

```bash
# Connect to server
ssh -i myphotos-key.pem ubuntu@<YOUR_EC2_IP>

# Install Docker (Copy-paste this block)
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg docker-compose-plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io
sudo usermod -aG docker $USER
newgrp docker
```

### 4.3 Deploy App
```bash
# Clone repo
git clone https://github.com/voriq-ai/myphotos.git
cd myphotos

# Create .env file
nano .env
```

**Paste this configuration:**
```env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/myphotos"

# AWS Config
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="<YOUR_ACCESS_KEY>"
AWS_SECRET_ACCESS_KEY="<YOUR_SECRET_KEY>"
AWS_S3_BUCKET="myphotos-production"

# Services
EMBEDDING_SERVICE_URL="<URL_FROM_STEP_2>"

# Import Service
AWS_SQS_QUEUE_URL="<URL_FROM_STEP_1_MAIN>"
AWS_SQS_DLQ_URL="<URL_FROM_STEP_1_DLQ>"

# Google Auth (Get these from Google Cloud Console)
GOOGLE_CLIENT_ID="<YOUR_CLIENT_ID>"
GOOGLE_CLIENT_SECRET="<YOUR_SECRET>"
GOOGLE_REDIRECT_URI="http://<YOUR_EC2_IP>/api/auth/google/callback"

# Security
NEXTAUTH_SECRET="<RANDOM_STRING>"
NEXTAUTH_URL="http://<YOUR_EC2_IP>"
ENCRYPTION_KEY="<RANDOM_STRING>"
```
*(Save with Ctrl+X, Y, Enter)*

**Start the App:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4.4 Final Verification
1.  Visit `http://<YOUR_EC2_IP>` in your browser.
2.  Try uploading a photo.
3.  Check if face recognition works (it uses the Lambda).

**Done! Your MyPhotos app is fully deployed on AWS.**
