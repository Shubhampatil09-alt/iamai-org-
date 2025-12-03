#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting AWS Deployment Setup...${NC}"

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo -e "${RED}Error: aws cli is not installed.${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}Error: jq is not installed.${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Error: docker is not installed.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}Error: npm is not installed.${NC}"; exit 1; }

# Configuration
REGION=$(aws configure get region)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
SUFFIX=$(date +%s)
BUCKET_NAME="myphotos-production-${SUFFIX}"
QUEUE_NAME="myphotos-gdrive-imports-${SUFFIX}"
DLQ_NAME="myphotos-gdrive-imports-dlq-${SUFFIX}"
ECR_REPO_NAME="myphotos-embedding-service"
LAMBDA_ROLE_NAME="MyPhotosLambdaRole-${SUFFIX}"
EMBEDDING_LAMBDA_NAME="myphotos-embedding-service-${SUFFIX}"
IMPORT_LAMBDA_NAME="myphotos-import-service-${SUFFIX}"

if [ -z "$REGION" ]; then
    echo -e "${RED}Error: AWS region not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}Using Region: $REGION${NC}"
echo -e "${GREEN}Using Account ID: $ACCOUNT_ID${NC}"

# 1. Create S3 Bucket
echo -e "${BLUE}Creating S3 Bucket: $BUCKET_NAME...${NC}"
if [ "$REGION" == "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION"
else
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
fi
aws s3api put-public-access-block --bucket "$BUCKET_NAME" --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 2. Create SQS Queues
echo -e "${BLUE}Creating SQS Queues...${NC}"
DLQ_URL=$(aws sqs create-queue --queue-name "$DLQ_NAME" --query QueueUrl --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)

MAIN_QUEUE_URL=$(aws sqs create-queue --queue-name "$QUEUE_NAME" --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\", \"VisibilityTimeout\":\"300\"}" --query QueueUrl --output text)
MAIN_QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$MAIN_QUEUE_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)

echo -e "${GREEN}S3 Bucket: $BUCKET_NAME${NC}"
echo -e "${GREEN}SQS Queue: $MAIN_QUEUE_URL${NC}"

# 3. Create IAM Role
echo -e "${BLUE}Creating IAM Role...${NC}"
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role --role-name "$LAMBDA_ROLE_NAME" --assume-role-policy-document file://trust-policy.json >/dev/null
rm trust-policy.json

# Attach policies
aws iam attach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess

echo -e "${BLUE}Waiting for IAM role propagation...${NC}"
sleep 10
ROLE_ARN=$(aws iam get-role --role-name "$LAMBDA_ROLE_NAME" --query Role.Arn --output text)

# 4. Deploy Embedding Service (Docker)
echo -e "${BLUE}Deploying Embedding Service...${NC}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" >/dev/null 2>&1 || aws ecr create-repository --repository-name "$ECR_REPO_NAME"

cd ../embedding-service
docker build --platform linux/amd64 -t "$ECR_REPO_NAME" .
docker tag "$ECR_REPO_NAME:latest" "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:latest"
docker push "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:latest"

echo -e "${BLUE}Creating Embedding Lambda Function...${NC}"
aws lambda create-function \
    --function-name "$EMBEDDING_LAMBDA_NAME" \
    --package-type Image \
    --code ImageUri="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:latest" \
    --role "$ROLE_ARN" \
    --timeout 300 \
    --memory-size 1024 \
    --environment "Variables={AWS_S3_BUCKET=$BUCKET_NAME}" >/dev/null

aws lambda wait function-active --function-name "$EMBEDDING_LAMBDA_NAME"

EMBEDDING_URL=$(aws lambda create-function-url-config \
    --function-name "$EMBEDDING_LAMBDA_NAME" \
    --auth-type NONE \
    --query FunctionUrl --output text)

aws lambda add-permission \
    --function-name "$EMBEDDING_LAMBDA_NAME" \
    --action lambda:InvokeFunctionUrl \
    --statement-id FunctionURLAllowPublicAccess \
    --principal "*" \
    --function-url-auth-type NONE >/dev/null

echo -e "${GREEN}Embedding Service URL: $EMBEDDING_URL${NC}"

# 5. Deploy Import Service (Node.js)
echo -e "${BLUE}Deploying Import Service...${NC}"
cd ../lambda-gdrive-import
npm install
zip -r function.zip .

echo -e "${BLUE}Creating Import Lambda Function...${NC}"
aws lambda create-function \
    --function-name "$IMPORT_LAMBDA_NAME" \
    --runtime nodejs18.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb://function.zip \
    --timeout 60 \
    --environment "Variables={AWS_S3_BUCKET=$BUCKET_NAME,EMBEDDING_SERVICE_URL=$EMBEDDING_URL}" >/dev/null

aws lambda create-event-source-mapping \
    --function-name "$IMPORT_LAMBDA_NAME" \
    --batch-size 10 \
    --event-source-arn "$MAIN_QUEUE_ARN" >/dev/null

cd ../deployment-scripts

# 6. Create EC2 Instance
echo -e "${BLUE}Creating EC2 Instance...${NC}"

# 6.1 Create Key Pair
KEY_NAME="myphotos-key-${SUFFIX}"
echo -e "${BLUE}Creating Key Pair: $KEY_NAME...${NC}"
aws ec2 create-key-pair --key-name "$KEY_NAME" --query 'KeyMaterial' --output text > "$KEY_NAME.pem"
chmod 400 "$KEY_NAME.pem"
echo -e "${GREEN}Key Pair created: $KEY_NAME.pem${NC}"

# 6.2 Create Security Group
SG_NAME="myphotos-sg-${SUFFIX}"
echo -e "${BLUE}Creating Security Group: $SG_NAME...${NC}"
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" --description "MyPhotos Security Group" --vpc-id "$VPC_ID" --query GroupId --output text)

aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
echo -e "${GREEN}Security Group created: $SG_ID${NC}"

# 6.3 Get Ubuntu AMI
echo -e "${BLUE}Finding latest Ubuntu 22.04 AMI...${NC}"
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
    --query "sort_by(Images, &CreationDate)[-1].ImageId" \
    --output text)
echo -e "${GREEN}Using AMI: $AMI_ID${NC}"

# 6.4 Launch Instance
echo -e "${BLUE}Launching EC2 Instance (t3.medium)...${NC}"
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --count 1 \
    --instance-type t3.medium \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=MyPhotos-Server-${SUFFIX}}]" \
    --query "Instances[0].InstanceId" \
    --output text)

echo -e "${BLUE}Waiting for instance to be running...${NC}"
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query "Reservations[0].Instances[0].PublicIpAddress" --output text)

echo -e "${GREEN}Instance Launched! Public IP: $PUBLIC_IP${NC}"

# 7. Generate secrets.env
echo -e "${BLUE}Generating secrets.env...${NC}"
cat > secrets.env <<EOF
AWS_REGION=$REGION
AWS_S3_BUCKET=$BUCKET_NAME
AWS_SQS_QUEUE_URL=$MAIN_QUEUE_URL
AWS_SQS_DLQ_URL=$DLQ_URL
EMBEDDING_SERVICE_URL=$EMBEDDING_URL
EC2_PUBLIC_IP=$PUBLIC_IP
EC2_KEY_PATH=$(pwd)/$KEY_NAME.pem
EOF

echo -e "${GREEN}Deployment Setup Complete!${NC}"
echo -e "${GREEN}Resources created and secrets.env generated.${NC}"
echo -e "${GREEN}EC2 Instance IP: $PUBLIC_IP${NC}"
echo -e "${GREEN}Key Pair saved to: $(pwd)/$KEY_NAME.pem${NC}"
echo -e "${GREEN}Next Step: Follow the UNIFIED_DEPLOYMENT_GUIDE.md to deploy the app to your new server.${NC}"
