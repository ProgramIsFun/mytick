#!/bin/bash
# Setup Terraform Remote State Backend (S3 + DynamoDB)
# Run this ONCE before running terraform init

set -e

# Configuration
BUCKET_NAME="nexus-backup-terraform-state"  # Change to your unique bucket name
DYNAMODB_TABLE="nexus-backup-terraform-locks"
REGION="us-east-1"

echo "🚀 Setting up Terraform remote state backend..."
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI not configured. Run 'aws configure' first."
  exit 1
fi

# Get AWS account details
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ACCOUNT_USER=$(aws sts get-caller-identity --query Arn --output text)
ACCOUNT_ALIAS=$(aws iam list-account-aliases --query 'AccountAliases[0]' --output text 2>/dev/null || echo "No alias set")

echo "════════════════════════════════════════════════════════════════"
echo "📋 AWS ACCOUNT INFORMATION"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Account ID:    $ACCOUNT_ID"
echo "  Account Alias: $ACCOUNT_ALIAS"
echo "  Identity:      $ACCOUNT_USER"
echo "  Region:        $REGION"
echo ""
echo "  Will create:"
echo "    • S3 Bucket:       $BUCKET_NAME"
echo "    • DynamoDB Table:  $DYNAMODB_TABLE"
echo ""
echo "  Estimated cost:  ~\$0.05/month"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Confirmation prompt
read -p "⚠️  Is this the CORRECT AWS account? (yes/no): " CONFIRMATION

if [[ ! "$CONFIRMATION" =~ ^[Yy][Ee][Ss]$ ]]; then
  echo ""
  echo "❌ Setup cancelled by user."
  echo ""
  echo "To switch AWS accounts:"
  echo "  • Use different profile: export AWS_PROFILE=<profile-name>"
  echo "  • Or configure new profile: aws configure --profile <profile-name>"
  exit 1
fi

echo ""
echo "✅ Confirmed - proceeding with setup..."
echo ""

# Create S3 bucket for state
echo "📦 Checking S3 bucket: $BUCKET_NAME"
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
  echo "✅ Bucket already exists"
  BUCKET_EXISTS=true
else
  echo "📦 Creating bucket..."
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || \
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
  echo "✅ Bucket created"
  BUCKET_EXISTS=false
fi

# Enable versioning (idempotent - safe to run multiple times)
echo "🔄 Configuring versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled
echo "✅ Versioning enabled"

# Enable encryption (idempotent - safe to run multiple times)
echo "🔒 Configuring encryption..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
echo "✅ Encryption enabled"

# Block public access (idempotent - safe to run multiple times)
echo "🚫 Configuring public access block..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✅ Public access blocked"

# Create DynamoDB table for state locking
echo "🔐 Creating DynamoDB table: $DYNAMODB_TABLE"
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$REGION" &>/dev/null; then
  echo "⚠️  Table already exists, skipping..."
else
  aws dynamodb create-table \
    --table-name "$DYNAMODB_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  
  echo "⏳ Waiting for table to be active..."
  aws dynamodb wait table-exists --table-name "$DYNAMODB_TABLE" --region "$REGION"
  echo "✅ Table created"
fi

echo ""
echo "🎉 Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Update terraform/backend.tf with your bucket name: $BUCKET_NAME"
echo "2. Run: cd terraform && terraform init"
echo "3. Terraform will store state securely in S3"
echo ""
echo "💰 Estimated cost: ~$0.05/month (S3 + DynamoDB)"
echo ""
echo "✅ This script is idempotent - safe to run multiple times!"
echo ""
