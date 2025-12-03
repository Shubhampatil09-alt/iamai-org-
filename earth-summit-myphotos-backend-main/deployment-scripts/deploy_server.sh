#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Starting Server Deployment...${NC}"

# Check if running from correct directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}Error: Please run this script from the 'earth-summit-myphotos-backend' directory.${NC}"
    exit 1
fi

# Check for secrets.env
if [ ! -f "secrets.env" ]; then
    echo -e "${RED}Error: secrets.env not found. Please copy it from your local machine.${NC}"
    exit 1
fi

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Error: docker is not installed.${NC}"; exit 1; }

# Prompt for Domains
read -p "Enter Frontend Domain (e.g., myphotos.example.com): " FRONTEND_DOMAIN
read -p "Enter Admin Domain (e.g., admin.example.com): " ADMIN_DOMAIN

if [ -z "$FRONTEND_DOMAIN" ] || [ -z "$ADMIN_DOMAIN" ]; then
    echo -e "${RED}Error: Domains cannot be empty.${NC}"
    exit 1
fi

# Update Nginx Config
echo -e "${BLUE}Updating Nginx Configuration...${NC}"
# Backup original
cp nginx/conf/default.conf nginx/conf/default.conf.bak

# Replace domains using sed
sed -i "s/myphotos.earth-summit.com/$FRONTEND_DOMAIN/g" nginx/conf/default.conf
sed -i "s/myphotosadmin.earth-summit.com/$ADMIN_DOMAIN/g" nginx/conf/default.conf

echo -e "${GREEN}Nginx config updated with $FRONTEND_DOMAIN and $ADMIN_DOMAIN${NC}"

# Update .env files
echo -e "${BLUE}Configuring Environment Variables...${NC}"

# Load secrets
source secrets.env

# Backend .env
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
fi

# Update/Append variables in Backend .env
# Function to update or append env var
update_env() {
    local file=$1
    local key=$2
    local value=$3
    if grep -q "^$key=" "$file"; then
        sed -i "s|^$key=.*|$key=\"$value\"|" "$file"
    else
        echo "$key=\"$value\"" >> "$file"
    fi
}

update_env ".env" "AWS_REGION" "$AWS_REGION"
update_env ".env" "AWS_S3_BUCKET" "$AWS_S3_BUCKET"
update_env ".env" "AWS_SQS_QUEUE_URL" "$AWS_SQS_QUEUE_URL"
update_env ".env" "AWS_SQS_DLQ_URL" "$AWS_SQS_DLQ_URL"
update_env ".env" "EMBEDDING_SERVICE_URL" "$EMBEDDING_SERVICE_URL"
update_env ".env" "NEXTAUTH_URL" "https://$ADMIN_DOMAIN"

# Frontend .env
FRONTEND_ENV="../earth-summit-frontend/.env"
if [ ! -f "$FRONTEND_ENV" ]; then
    touch "$FRONTEND_ENV"
fi
update_env "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL" "https://$ADMIN_DOMAIN/api"

echo -e "${GREEN}Environment variables updated.${NC}"

# Run Docker Compose
echo -e "${BLUE}Starting Services with Docker Compose...${NC}"
docker compose -f docker-compose.prod.yml up -d --build

# SSL Setup
echo -e "${BLUE}Setting up SSL with Certbot...${NC}"
# We need to request certificates for both domains
# Using webroot mode with the nginx container handling the challenge
docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d "$FRONTEND_DOMAIN" -d "$ADMIN_DOMAIN" --email admin@"$ADMIN_DOMAIN" --agree-tos --no-eff-email --force-renewal

echo -e "${BLUE}Reloading Nginx to apply SSL...${NC}"
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}Frontend: https://$FRONTEND_DOMAIN${NC}"
echo -e "${GREEN}Admin: https://$ADMIN_DOMAIN${NC}"
