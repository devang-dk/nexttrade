output "ec2_public_ip" {
  description = "Elastic IP of the NexTrade EC2 instance"
  value       = aws_eip.nextrade.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i terraform/nextrade-key.pem ubuntu@${aws_eip.nextrade.public_ip}"
}

output "app_urls" {
  description = "Application endpoints"
  value = {
    frontend   = "http://${aws_eip.nextrade.public_ip}:8081"
    client     = "http://${aws_eip.nextrade.public_ip}:3000"
    api        = "http://${aws_eip.nextrade.public_ip}:10000"
    grafana    = "http://${aws_eip.nextrade.public_ip}:3001"
    prometheus = "http://${aws_eip.nextrade.public_ip}:9090"
  }
}

output "jenkins_credentials_setup" {
  description = "Steps to configure Jenkins after terraform apply"
  value       = <<-EOT
    ── Jenkins Credentials to add ────────────────────────────
    1. deploy-server-ssh-key  → SSH Private Key → paste contents of terraform/nextrade-key.pem
    2. deploy-host            → Secret text     → ${aws_eip.nextrade.public_ip}
    3. nextrade-env-file      → Secret file     → upload your .env file
    ─────────────────────────────────────────────────────────
  EOT
}
