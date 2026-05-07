variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_s3_bucket" {
  description = "S3 bucket name for backups (must be globally unique)"
  type        = string
}

variable "projects" {
  description = "Projects to backup (JSON string with serviceToken per project)"
  type        = string
  default     = "[{\"name\":\"mytick\",\"apiUrl\":\"https://api.mytick.app\",\"serviceToken\":\"\"}]"
}

variable "BW_CLIENTSECRET" {
  description = "Bitwarden machine account access token"
  type        = string
  sensitive   = true
}
