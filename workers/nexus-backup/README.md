# Nexus Backup

**Backup executor service for the MyTick platform.**

Universal database backup service using AWS Lambda + S3 Glacier Instant Retrieval.

---

## Architecture

nexus-backup is a **platform service** that executes backups for all projects registered in MyTick.

### How It Works

```
MyTick Backend (Central Registry)
├── Stores metadata for ALL project databases
├── API: GET /api/databases/backupable
└── Returns: Database configs (MyTick, EonTrading, etc.)

    ↓ tells what to backup

nexus-backup (Executor Service)
├── Queries MyTick API only
├── Has NO knowledge of projects/databases
└── Executes backups as instructed
```

**Key Points:**
- **Registry:** MyTick backend is the single source of truth
- **Executor:** nexus-backup is a dumb executor (no business logic)
- **Protocol:** HTTP API contract (`/api/databases/backupable`)
- **Scope:** Backs up databases for ALL projects (MyTick, EonTrading, future projects)

### Why Separate Repositories?

**nexus-backup is infrastructure, not application code:**

| Aspect | MyTick | nexus-backup |
|--------|--------|--------------|
| **Purpose** | Task management + DB registry | Backup executor |
| **Tech Stack** | Node.js, TypeScript, React | Docker, Terraform, AWS Lambda |
| **Deployment** | Firebase Hosting / App server | AWS Lambda (infrastructure) |
| **Domain** | Application code | Infrastructure as Code |

**This is standard for platform architectures:**
- AWS Control Plane (registry) + AWS Backup Service (executor)
- Kubernetes API (registry) + Velero (backup operator)
- MyTick Platform (registry) + nexus-backup (executor)

**Related Services:**
- [MyTick Platform](https://github.com/ProgramIsFun/mytick) - Central database registry

---

## Features

- ✅ **Platform service** for MyTick (backs up all registered projects)
- ✅ Multi-project support (MyTick, EonTrading, etc.)
- ✅ Multi-database support (MongoDB, PostgreSQL, MySQL, Redis)
- ✅ Automated daily backups via EventBridge
- ✅ Cost-optimized storage (S3 Glacier Instant Retrieval)
- ✅ Retention policies (365 days)
- ✅ Failure alerts via SNS
- ✅ Secure secret management (Bitwarden)

## Infrastructure Resources

This Terraform configuration creates the following AWS resources:

| Resource | Purpose | Estimated Cost/Month |
|----------|---------|---------------------|
| **ECR Repository** | Stores Lambda container images (~500MB) | $0.05 |
| **Lambda Function** | Executes backups (1GB RAM, 30 × 2min/month) | $0.06 |
| **S3 Bucket** | Backup storage with Glacier Instant (15GB) | $0.06 |
| **S3 Lifecycle Policy** | Auto-transition to Glacier, 365-day retention | Free |
| **EventBridge Rule** | Daily cron trigger (2am UTC) | Free |
| **CloudWatch Log Group** | Lambda logs (500MB/month, 14-day retention) | $0.02 |
| **CloudWatch Alarm** | Alerts on Lambda errors | $0.10 |
| **SNS Topic** | Failure notifications | Free |
| **IAM Role + Policy** | Lambda permissions | Free |
| **Remote State (S3 + DynamoDB)** | Terraform state storage & locking | $0.05 |
| | **Total** | **~$0.34/month** |

**With AWS Free Tier (first 12 months):**
- ECR: Free (500MB < free tier)
- Lambda: Free (3,600 GB-seconds < 400K limit)
- CloudWatch: Free (500MB < 5GB limit)
- CloudWatch Alarm: Free (1 alarm < 10 limit)
- **First year: ~$0.11/month** (only S3 Glacier + remote state)

**Assumptions:** 1 project, 1 database, 500MB backups, 30 daily runs

## How It Works

1. **EventBridge** triggers Lambda daily at 2am UTC
2. **Lambda** calls MyTick API: `GET /api/databases/backupable`
3. **MyTick** returns database configs for ALL projects (MyTick, EonTrading, etc.)
4. **Bitwarden SDK** retrieves connection strings using `secretRefs`
5. **Backup tools** (mongodump, pg_dump, etc.) create backups
6. **S3 Glacier Instant** stores backups with lifecycle policies
7. **CloudWatch Alarms** notify via SNS on failures

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ MyTick Backend (Central Registry)                           │
│ - Stores: All project database metadata                     │
│ - API: /api/databases/backupable                            │
│ - Returns: [{name, type, host, secretRefs}, ...]            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (HTTP API Call)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ nexus-backup Lambda (Executor)                              │
│ 1. Fetch database list from MyTick                          │
│ 2. Retrieve secrets from Bitwarden                          │
│ 3. Execute backups (mongodump, pg_dump, etc.)               │
│ 4. Upload to S3 Glacier                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  (Backup files stored)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ S3 Glacier Instant Retrieval                                │
│ - 365 day retention                                         │
│ - Encrypted at rest                                         │
│ - Cost: $0.004/GB/month                                     │
└─────────────────────────────────────────────────────────────┘
```

**Important:** nexus-backup has NO built-in knowledge of databases. All metadata lives in MyTick.

---

## Directory Structure

```
nexus-backup/
├── lambda/
│   ├── src/
│   │   ├── index.js           # Main Lambda handler
│   │   ├── bitwarden.js       # Bitwarden SDK wrapper
│   │   ├── backup/
│   │   │   ├── mongodb.js     # MongoDB backup logic
│   │   │   ├── postgres.js    # PostgreSQL backup logic
│   │   │   └── mysql.js       # MySQL backup logic
│   │   └── storage/
│   │       └── wasabi.js      # Wasabi S3 upload
│   ├── package.json
│   └── Dockerfile             # Lambda container image
├── terraform/
│   ├── main.tf                # Lambda + EventBridge setup
│   ├── variables.tf
│   └── outputs.tf
├── config/
│   └── projects.example.json  # Project configuration template
└── README.md
```

## Setup

### 1. Prerequisites

- AWS account
- Wasabi account
- Bitwarden organization with service account
- Projects with `/api/databases/backupable` endpoint

### 2. Environment Variables

Set in Terraform `terraform.tfvars`:

```hcl
# Bitwarden Machine Account Access Token
BW_CLIENTSECRET = "0.xxxxx-xxxxx-xxxxx:yyyyy-yyyyy-yyyyy"

# AWS S3 Bucket (must be globally unique)
aws_s3_bucket = "nexus-backups-your-unique-name"

# Projects Configuration (JSON string)
# Each project needs a serviceToken (see below how to generate)
projects = "[{\"name\":\"mytick\",\"apiUrl\":\"https://api.mytick.app\",\"serviceToken\":\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\"}]"
```

### 3. Generate Service Token

**Option A: Via Web UI (Recommended)**

1. Login to MyTick at https://mytick.app (or http://localhost:4000)
2. Go to Settings page
3. Scroll to "🔑 Service Tokens" section
4. Enter service name: `nexus-backup`
5. Select expiry: `90 days (recommended)`
6. Click "Generate Token"
7. Copy the token and paste into `terraform.tfvars`

**Option B: Via API (Advanced)**

Each user must generate their own service token for Lambda:

```bash
# 1. Login to MyTick and get your JWT token
curl -X POST https://api.mytick.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your-password"}'

# Response: {"token":"eyJhbGc...", "user":{...}}

# 2. Generate service token for Lambda (90-day expiry)
curl -X POST https://api.mytick.app/api/auth/service-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{"service":"nexus-backup","expiresIn":"90d"}'

# Response: {"token":"eyJhbGc...","service":"nexus-backup","userId":"...","expiresIn":"90d"}

# 3. Copy the service token and add to terraform.tfvars
```

**Benefits of service tokens:**
- ✅ Per-user authentication (audit trail shows who triggered backups)
- ✅ No shared admin credentials
- ✅ Token can be revoked without affecting other users
- ✅ 90-day expiry for security (regenerate quarterly)

### 4. Setup Remote State (One-time)

```bash
# IMPORTANT: Do this BEFORE terraform init!
./scripts/setup-backend.sh

# This creates:
# - S3 bucket for state storage (encrypted)
# - DynamoDB table for state locking
# Cost: ~$0.05/month
```

### 5. Deploy

```bash
# Build Lambda container
cd lambda
docker build -t nexus-backup .

# Push to AWS ECR (will be created by Terraform)
# First, run terraform apply to create ECR repo
cd ../terraform
terraform init  # Will use remote state in S3
terraform plan
terraform apply

# Get ECR URL from output
ECR_URL=$(terraform output -raw ecr_repository_url)

# Now push the image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL
docker tag nexus-backup:latest $ECR_URL:latest
docker push $ECR_URL:latest

# Update Lambda to use new image
terraform apply -auto-approve
```

## Configuration

### Projects Configuration

Add projects to backup in `terraform.tfvars`:

```json
[
  {
    "name": "mytick",
    "apiUrl": "https://api.mytick.app",
    "serviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  {
    "name": "eontrading",
    "apiUrl": "https://api.eontrading.com",
    "serviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
]
```

Each user generates their own service token (see setup step 3).

### Backup Retention

Default retention policy:
- Last 7 days: Daily backups
- Last 30 days: Weekly backups
- Last 365 days: Monthly backups
- After 1 year: Deleted

## Scaling Cost Estimates

| Scenario | Databases | Lambda | Storage | Total/Month |
|----------|-----------|--------|---------|-------------|
| **Current (1 project)** | 1 | $0.06 | $0.06 | **$0.34** |
| **Small (5 projects)** | 5 | $0.30 | $0.30 | **$0.93** |
| **Medium (10 projects)** | 10 | $0.60 | $0.60 | **$1.53** |
| **Large (50 projects)** | 50 | $3.00 | $3.00 | **$6.33** |

*Includes all infrastructure costs (ECR, CloudWatch, alarms, remote state)*

### Storage Pricing Comparison

For detailed pricing comparison and alternative storage options, see [terraform/README.md](terraform/README.md)

**Alternative storage providers:**
- [AWS S3 Glacier Pricing](https://aws.amazon.com/s3/pricing/) (current choice)
- [Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing) ($0.09/month for 15GB)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) ($0.23/month for 15GB)
- [Wasabi Pricing](https://wasabi.com/pricing/) (1TB minimum, not cost-effective for small datasets)

## Monitoring

- CloudWatch Logs for Lambda execution
- SNS alerts for failures
- Backup success/failure metrics

## License

MIT
