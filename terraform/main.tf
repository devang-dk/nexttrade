# =====================================================================
# NexTrade — Terraform Infrastructure (AWS)
# Provisions: VPC · Subnet · IGW · Security Group · EC2 · Elastic IP
# =====================================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── SSH Key Pair ─────────────────────────────────────────────────────
# Generates an RSA key pair; private key is saved locally as nextrade-key.pem
# Add that file to Jenkins as a credential (ID: deploy-server-ssh-key)

resource "tls_private_key" "nextrade" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "nextrade" {
  key_name   = "${var.project_name}-key"
  public_key = tls_private_key.nextrade.public_key_openssh
}

resource "local_file" "private_key" {
  content         = tls_private_key.nextrade.private_key_pem
  filename        = "${path.module}/nextrade-key.pem"
  file_permission = "0600"
}

# ── VPC ──────────────────────────────────────────────────────────────
resource "aws_vpc" "nextrade" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

# ── Public Subnet ────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.nextrade.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.project_name}-public-subnet"
    Project = var.project_name
  }
}

# ── Internet Gateway ─────────────────────────────────────────────────
resource "aws_internet_gateway" "nextrade" {
  vpc_id = aws_vpc.nextrade.id

  tags = {
    Name    = "${var.project_name}-igw"
    Project = var.project_name
  }
}

# ── Route Table ──────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.nextrade.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.nextrade.id
  }

  tags = {
    Name    = "${var.project_name}-public-rt"
    Project = var.project_name
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ── Security Group ───────────────────────────────────────────────────
resource "aws_security_group" "nextrade" {
  name        = "${var.project_name}-sg"
  description = "NexTrade application security group"
  vpc_id      = aws_vpc.nextrade.id

  # SSH — Jenkins needs this to deploy
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # NexTrade Backend API
  ingress {
    from_port   = 10000
    to_port     = 10000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "NexTrade Server API"
  }

  # React Client (serve)
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "NexTrade React Client"
  }

  # Nginx Frontend (static HTML)
  ingress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "NexTrade Nginx Frontend"
  }

  # Grafana
  ingress {
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Grafana"
  }

  # Prometheus
  ingress {
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Prometheus"
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound"
  }

  tags = {
    Name    = "${var.project_name}-sg"
    Project = var.project_name
  }
}

# ── Latest Ubuntu 22.04 AMI ──────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── EC2 Instance ─────────────────────────────────────────────────────
resource "aws_instance" "nextrade" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.nextrade.id]
  key_name                    = aws_key_pair.nextrade.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 20    # 20 GB — enough for Docker images
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = file("${path.module}/user-data.sh")

  tags = {
    Name    = "${var.project_name}-server"
    Project = var.project_name
  }
}

# ── Elastic IP ───────────────────────────────────────────────────────
# Static IP that won't change on instance restart
resource "aws_eip" "nextrade" {
  instance = aws_instance.nextrade.id
  domain   = "vpc"

  tags = {
    Name    = "${var.project_name}-eip"
    Project = var.project_name
  }

  depends_on = [aws_internet_gateway.nextrade]
}
