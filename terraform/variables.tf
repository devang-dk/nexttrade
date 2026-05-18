variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1" # Mumbai — closest to India
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro" # Free tier eligible in ap-south-1 (Mumbai)
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "nextrade"
}

variable "dockerhub_user" {
  description = "Docker Hub username (used in user-data bootstrap)"
  type        = string
  default     = "ronnie75491"
}
