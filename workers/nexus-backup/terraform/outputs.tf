output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.nexus_backup.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.nexus_backup.arn
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.nexus_backup.id
}

output "eventbridge_schedule" {
  description = "EventBridge schedule expression"
  value       = aws_cloudwatch_event_rule.nexus_backup_schedule.schedule_expression
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing images"
  value       = aws_ecr_repository.nexus_backup.repository_url
}

output "sns_topic_arn" {
  description = "SNS topic ARN for backup alerts"
  value       = aws_sns_topic.backup_alerts.arn
}
