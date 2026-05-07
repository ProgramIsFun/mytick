# Terraform Remote State Configuration
# This file configures S3 backend for secure state storage

terraform {
  backend "s3" {
    bucket         = "nexus-backup-terraform-state"  # Must be globally unique - change this!
    key            = "nexus-backup/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "nexus-backup-terraform-locks"
    
    # Prevents accidental deletion
    # Enable after initial setup
    # lifecycle {
    #   prevent_destroy = true
    # }
  }
}

# Note: You must create the S3 bucket and DynamoDB table BEFORE running terraform init
# Run the setup script: ./scripts/setup-backend.sh
