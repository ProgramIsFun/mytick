terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ECR Repository for Lambda container image
resource "aws_ecr_repository" "nexus_backup" {
  name                 = "nexus-backup"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "nexus-backup"
    Description = "Container images for nexus-backup Lambda"
  }
}

# S3 Bucket for backups
resource "aws_s3_bucket" "nexus_backup" {
  bucket = var.aws_s3_bucket

  tags = {
    Name        = "nexus-backup"
    Description = "Backup storage for nexus-backup Lambda"
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "nexus_backup" {
  bucket = aws_s3_bucket.nexus_backup.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Lifecycle Policy
resource "aws_s3_bucket_lifecycle_configuration" "nexus_backup" {
  bucket = aws_s3_bucket.nexus_backup.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    # Apply to all objects in bucket
    filter {}

    transition {
      days          = 0
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = 365
    }
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "nexus-backup-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# IAM Policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "nexus-backup-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::${var.aws_s3_bucket}",
          "arn:aws:s3:::${var.aws_s3_bucket}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ],
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "nexus_backup" {
  name              = "/aws/lambda/nexus-backup"
  retention_in_days = 14

  tags = {
    Name = "nexus-backup-logs"
  }
}

# Lambda Function
resource "aws_lambda_function" "nexus_backup" {
  function_name = "nexus-backup"
  role          = aws_iam_role.lambda_role.arn

  image_uri    = "${aws_ecr_repository.nexus_backup.repository_url}:latest"
  package_type = "Image"
  memory_size  = 1024
  timeout      = 300

  environment {
    variables = {
      BW_CLIENTSECRET = var.BW_CLIENTSECRET
      AWS_S3_BUCKET   = var.aws_s3_bucket
      PROJECTS        = var.projects
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.nexus_backup,
    aws_iam_role_policy.lambda_policy
  ]
}

# EventBridge Rule (daily at 2am UTC)
resource "aws_cloudwatch_event_rule" "nexus_backup_schedule" {
  name                = "nexus-backup-daily"
  schedule_expression = "cron(0 2 * * ? *)"
}

# EventBridge Target
resource "aws_cloudwatch_event_target" "nexus_backup_lambda" {
  rule      = aws_cloudwatch_event_rule.nexus_backup_schedule.name
  target_id = "nexus-backup-lambda"
  arn       = aws_lambda_function.nexus_backup.arn
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nexus_backup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.nexus_backup_schedule.arn
}

# SNS Topic for failure notifications
resource "aws_sns_topic" "backup_alerts" {
  name = "nexus-backup-alerts"

  tags = {
    Name = "nexus-backup-alerts"
  }
}

# CloudWatch Alarm for Lambda errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "nexus-backup-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when nexus-backup Lambda fails"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.nexus_backup.function_name
  }

  alarm_actions = [aws_sns_topic.backup_alerts.arn]
}
