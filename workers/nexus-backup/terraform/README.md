# Nexus Backup - Terraform Setup

## Storage Options & Pricing

This setup uses **AWS S3 Glacier Instant Retrieval** for cost-optimized backup storage.

### Cost Comparison (15GB backups)

| Provider | Monthly Cost | Pricing Link |
|----------|--------------|--------------|
| **S3 Glacier Instant** ⭐ | **$0.06** | [AWS S3 Glacier Pricing](https://aws.amazon.com/s3/pricing/) |
| Backblaze B2 | $0.09 | [Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing) |
| S3 One Zone-IA | $0.15 | [AWS S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/) |
| Cloudflare R2 | $0.23 | [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) |
| AWS S3 Standard | $0.35 | [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/) |
| Wasabi | $5.99 (1TB min) | [Wasabi Pricing](https://wasabi.com/pricing/) |

### Why Glacier Instant Retrieval?

- ✅ **83% cheaper** than S3 Standard ($0.06 vs $0.35/month)
- ✅ **Instant access** - millisecond retrieval times
- ✅ **AWS native** - works seamlessly with Lambda
- ✅ **Same durability** - 99.999999999% (11 nines)
- ✅ **Perfect for backups** - rarely restored, long retention

**Note:** Retrieval costs $0.03/GB (only charged when restoring backups)

### Alternative Options

**Backblaze B2** ($0.09/month) - Good if you need frequent downloads or plan to scale beyond 100GB
- S3-compatible API
- 3x free daily egress
- No minimum storage

**Cloudflare R2** ($0.23/month) - Good if you need unlimited free egress
- S3-compatible API
- Zero egress fees
- Good for frequent restores

## Prerequisites
- AWS CLI configured with credentials
- Docker installed
- Terraform installed (`brew install terraform`)

## Deployment

### 0. Setup Remote State Backend (FIRST TIME ONLY)

**IMPORTANT:** Do this before `terraform init` to avoid storing state locally.

```bash
# 1. Edit the bucket name in backend.tf to something unique
# Change: nexus-backup-terraform-state → your-unique-name-terraform-state

# 2. Run the setup script
cd /Users/230342/Desktop/ref/nexus-backup
./scripts/setup-backend.sh

# 3. The script creates:
#    - S3 bucket (encrypted, versioned, private)
#    - DynamoDB table (for state locking)
# Cost: ~$0.05/month
```

**Why remote state?**
- ✅ State files contain secrets (never commit to git!)
- ✅ Team collaboration (shared state)
- ✅ State locking (prevents concurrent modifications)
- ✅ Versioning (rollback capability)
- ✅ Encryption at rest

### 1. Build and push Lambda container
```bash
cd /Users/230342/Desktop/ref/nexus-backup/lambda
docker build -t nexus-backup .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
docker tag nexus-backup:latest <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/nexus-backup:latest
docker push <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/nexus-backup:latest
```

### 2. Configure Terraform variables
Create `terraform.tfvars`:
```hcl
BW_CLIENTID         = "user.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
BW_CLIENTSECRET     = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
AWS_S3_BUCKET       = "nexus-backups-<your-unique-name>"
projects            = "[{\"name\":\"mytick\",\"apiUrl\":\"https://api.mytick.app\",\"adminKey\":\"...\",\"adminUserId\":\"69d7a64ca9fc2c22bfe37501\"}]"
```

### 3. Deploy
```bash
cd /Users/230342/Desktop/ref/nexus-backup/terraform
terraform init
terraform apply -auto-approve
```

### 4. Verify
```bash
terraform output
```

## Cleanup
```bash
terraform destroy -auto-approve
```

## Cost Estimate

**Monthly costs (15GB backups, 30 daily uploads):**
- **Lambda compute**: $0.06 (30 × 120s × 1GB)
- **CloudWatch Logs**: $0.02 (14-day retention, ~500MB/month)
- **S3 Glacier Instant**: $0.06 (15GB × $0.004/GB)
- **S3 API requests**: ~$0.00 (negligible)
- **Total**: **~$0.14/month**

**First year with AWS free tier:**
- Lambda: **$0.00** (within 400K GB-seconds free tier)
- CloudWatch: **$0.00** (within 5GB ingestion free tier)
- S3 Glacier: **$0.06**
- **Total**: **~$0.06/month**

**Savings vs S3 Standard:** 83% cheaper ($0.14 vs $1.16/month)
