#!/bin/bash

FUNCTION_NAME="myphotos-embedding-service"
REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="myphotos-embedding"
IMAGE_TAG="latest"

echo "Building Docker image with Ubuntu base..."
docker build --platform linux/amd64 --provenance=false -f Dockerfile.lambda -t $ECR_REPO:$IMAGE_TAG .

# Create ECR repo if needed
aws ecr describe-repositories --repository-names $ECR_REPO --region $REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $ECR_REPO --region $REGION

# Login and push
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"
docker tag $ECR_REPO:$IMAGE_TAG $IMAGE_URI
docker push $IMAGE_URI

# Create/update Lambda
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Updating function..."
    aws lambda update-function-code --function-name $FUNCTION_NAME --image-uri $IMAGE_URI --region $REGION
    aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION
    aws lambda update-function-configuration --function-name $FUNCTION_NAME --timeout 900 --memory-size 10240 --region $REGION
else
    echo "Creating function..."
    ROLE_ARN=$(aws iam get-role --role-name myphotos-embedding-lambda-role --query 'Role.Arn' --output text 2>/dev/null)
    if [ -z "$ROLE_ARN" ]; then
        echo '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' > trust.json
        ROLE_ARN=$(aws iam create-role --role-name myphotos-embedding-lambda-role --assume-role-policy-document file://trust.json --query 'Role.Arn' --output text)
        aws iam attach-role-policy --role-name myphotos-embedding-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        aws iam attach-role-policy --role-name myphotos-embedding-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
        rm trust.json
        sleep 10
    else
        # Ensure S3 policy is attached to existing role
        aws iam attach-role-policy --role-name myphotos-embedding-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess 2>/dev/null || true
    fi

    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --package-type Image \
        --code ImageUri=$IMAGE_URI \
        --role $ROLE_ARN \
        --timeout 900 \
        --memory-size 10240 \
        --region $REGION \
        --environment Variables={MPLCONFIGDIR=/tmp}
fi

aws lambda wait function-active --function-name $FUNCTION_NAME --region $REGION

# Get or create Function URL
FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION --query 'FunctionUrl' --output text 2>/dev/null)
if [ -z "$FUNCTION_URL" ]; then
    FUNCTION_URL=$(aws lambda create-function-url-config --function-name $FUNCTION_NAME --auth-type NONE --cors AllowOrigins='*',AllowMethods='*',AllowHeaders='*' --region $REGION --query 'FunctionUrl' --output text)
    aws lambda add-permission --function-name $FUNCTION_NAME --statement-id FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl --principal "*" --function-url-auth-type NONE --region $REGION 2>/dev/null || true
fi

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo "Function URL: $FUNCTION_URL"
echo ""
echo "Add to your .env:"
echo "EMBEDDING_SERVICE_URL=$FUNCTION_URL"
echo "========================================="
