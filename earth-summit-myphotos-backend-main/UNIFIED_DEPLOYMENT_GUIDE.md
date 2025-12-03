# Unified Deployment Guide for MyPhotos

This guide provides a single, automated path to deploy the entire MyPhotos stack (Frontend, Backend, Admin Portal, Lambdas, S3, SQS) on AWS.

## 📋 Prerequisites

### Local Machine
You need the following tools installed on your local machine (where you have the code):
1.  **AWS CLI**: [Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2.  **Docker**: [Install Guide](https://docs.docker.com/get-docker/)
3.  **Node.js & npm**: [Install Guide](https://nodejs.org/)
4.  **jq**: [Install Guide](https://stedolan.github.io/jq/download/) (Used for parsing JSON)

### AWS Account
- An AWS Account with an IAM User having `AdministratorAccess` (or broad permissions for S3, SQS, Lambda, IAM, ECR, and EC2).
- **Configure AWS CLI**:
    ```bash
    aws configure
    ```
    Enter your Access Key, Secret Key, and preferred region (e.g., `ap-south-1`).

---



## 🚀 Step 1: Automated Infrastructure Setup

This step creates **ALL** AWS resources: S3, SQS, IAM Roles, Lambdas, and the **EC2 Server**.

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/iamai-org/earth-summit-myphotos-backend.git
    cd earth-summit-myphotos-backend
    ```

2.  **Update Watermark Logo (Mandatory)**:
    *Each deployment is for a specific event. You MUST update the watermark logo before deploying.*
    1.  Navigate to `earth-summit-myphotos-backend/lambda-gdrive-import/`.
    2.  Replace `logo.png` with your event's logo (keep the filename `logo.png`).

3.  Run the setup script:
    ```bash
    ./deployment-scripts/setup_aws.sh
    ```
4.  **Wait for completion**. The script will:
    - Create an S3 Bucket and SQS Queues.
    - Create IAM Roles.
    - Build and Push the Embedding Service Docker image to ECR.
    - Deploy both Lambda functions.
    - **Launch an EC2 Instance** (Ubuntu 22.04, t3.medium).
    - **Create a Key Pair** (`.pem` file) in the current directory.
    - **Generate a `secrets.env` file** containing all resource details and the server IP.

> [!IMPORTANT]
> Keep the `secrets.env` and the generated `.pem` key file safe! You will need them for the next step.

---

## ☁️ Step 2: Application Deployment

Now that the server is running, we will deploy the application code to it.

### 2.1 Connect to the Server
The `setup_aws.sh` script outputted the `EC2 Instance IP` and the Key Pair filename.
Connect using SSH:
```bash
# Example
ssh -i myphotos-key-<TIMESTAMP>.pem ubuntu@<EC2_PUBLIC_IP>
```

### 2.2 Prepare the Server
On your EC2 instance, install Docker and Docker Compose:
```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install Docker packages:
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.3 Copy Code and Secrets
You need to copy the code and the secrets to the server.
1.  **Clone the repositories** (on the server):
    ```bash
    # In your home directory (~/)
    git clone https://github.com/iamai-org/earth-summit-frontend.git earth-summit-frontend
    git clone https://github.com/iamai-org/earth-summit-myphotos-backend.git earth-summit-myphotos-backend
    ```

2.  **Copy `secrets.env`** (from your local machine):
    Open a **new terminal** on your local machine and run:
    ```bash
    scp -i myphotos-key-<TIMESTAMP>.pem deployment-scripts/secrets.env ubuntu@<EC2_PUBLIC_IP>:~/earth-summit-myphotos-backend/deployment-scripts/
    ```


### 2.3 Customization (Optional)
Now that you have the code on the server, you can customize it for your event.



#### Customize Frontend (Event Name & Text)
The frontend is designed to be generic. You can change the event name, headings, and other text in the configuration file.
1.  Open `earth-summit-frontend/src/config/site-config.json`.
2.  Update the fields to match your event:
    ```json
    {
      "siteName": "My Event Photos",
      "heading": "Welcome to My Event",
      "subheading": "Relive your moments"
      ...
    }
    ```

#### Customize Frontend Assets (Logo & Favicon)
To fully brand the site, you should replace the default images.

**1. Website Logo:**
- Replace `earth-summit-frontend/public/logo.svg` with your event logo.
- Ensure it is an SVG or update `site-config.json` to point to a new filename (e.g., `/logo.png`).

**2. Favicons:**
- Navigate to `earth-summit-frontend/src/app/`.
- Replace the following files with your own versions:
    - `favicon.ico`
    - `favicon-16x16.png`
    - `favicon-32x32.png`
    - `apple-touch-icon.png`
    - `android-chrome-192x192.png`
    - `android-chrome-512x512.png`

### 2.4 Run Deployment Script

1.  Back on the server, navigate to the backend directory:
    ```bash
    cd ~/earth-summit-myphotos-backend
    ```
2.  Run the deployment script:
    ```bash
    chmod +x deployment-scripts/deploy_server.sh
    ./deployment-scripts/deploy_server.sh
    ```
3.  **Follow the prompts**:
    - Enter your **Frontend Domain** (e.g., `myphotos.example.com`).
    - Enter your **Admin Domain** (e.g., `admin.example.com`).

The script will:
- Configure Nginx for your domains.
- Update `.env` files with AWS secrets and domains.
- Start the application using Docker Compose.
- Automatically set up SSL certificates using Certbot.

---

## ✅ Verification
1.  Visit your **Frontend Domain**. You should see the main website.
2.  Visit your **Admin Domain**. You should see the admin portal.
3.  **Test Upload**: Upload a photo on the frontend.
4.  **Check Processing**: The photo should be processed by the Lambda functions (check CloudWatch logs if needed).

## 🛠 Troubleshooting
- **Nginx/SSL Issues**: Check logs with `docker compose logs nginx` or `docker compose logs certbot`.
- **Lambda Issues**: Check AWS CloudWatch Logs for the specific Lambda function.
- **Database**: The database is running in a Docker container (`myphotos-postgres`). Data is persisted in `./pgdata`.
