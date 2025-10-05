# Agents

- [ ] Orchestrate multiple LLM calls for complex queries

# AWS Infrastructure - Terraform

## Required Resources

### Compute
- [ ] **ECS Cluster** - Container orchestration
- [ ] **ECS Task Definition** - NestJS API container specs
- [ ] **ECS Service** - Running tasks with auto-scaling
- [ ] **Application Load Balancer** - Traffic distribution
- [ ] **Target Group** - ALB targets

### Networking
- [ ] **VPC** - Virtual private cloud
- [ ] **Public Subnets** (2 AZs) - Load balancer
- [ ] **Private Subnets** (2 AZs) - ECS tasks
- [ ] **Internet Gateway** - Public internet access
- [ ] **NAT Gateways** (2 AZs) - Private subnet internet
- [ ] **Security Groups** - ALB and ECS task rules
- [ ] **Route Tables** - Network routing

### Storage & Database
- [ ] **S3 Bucket** - Vector store persistence
- [ ] **RDS PostgreSQL** (Optional) - Application data
- [ ] **ElastiCache Redis** (Optional) - Caching layer

### Secrets & Configuration
- [ ] **Secrets Manager** - API keys storage
  - Blizzard API credentials
  - OpenAI API key
- [ ] **Parameter Store** - Application config
  - Region settings
  - Feature flags

### Monitoring & Logging
- [ ] **CloudWatch Log Groups** - Application logs
- [ ] **CloudWatch Alarms** - Resource monitoring
- [ ] **X-Ray** (Optional) - Distributed tracing

### CI/CD
- [ ] **ECR Repository** - Docker images
- [ ] **CodePipeline** (Optional) - Automated deployments
- [ ] **CodeBuild** (Optional) - Build automation

### IAM
- [ ] **ECS Task Execution Role** - Pull images, write logs
- [ ] **ECS Task Role** - S3, Secrets Manager access
- [ ] **Service-Linked Roles** - ECS service operations

### DNS & SSL
- [ ] **Route 53 Hosted Zone** - DNS management
- [ ] **ACM Certificate** - HTTPS/SSL
- [ ] **Route 53 Records** - Domain routing

## Terraform Structure

```
terraform/
├── main.tf           # Main configuration
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── providers.tf      # AWS provider config
├── modules/
│   ├── networking/   # VPC, subnets, etc.
│   ├── compute/      # ECS cluster, services
│   ├── storage/      # S3, RDS
│   └── security/     # IAM, Security Groups
└── environments/
    ├── dev/
    ├── staging/
    └── prod/
```

## Estimated Monthly Costs (us-east-1)

| Resource | Specification | Est. Cost |
|----------|--------------|-----------|
| ECS Fargate | 0.5 vCPU, 1GB RAM | ~$15 |
| ALB | Standard | ~$20 |
| NAT Gateway | 2x (HA) | ~$65 |
| S3 | Vector store (~1GB) | <$1 |
| RDS (Optional) | db.t3.micro | ~$15 |
| ElastiCache (Optional) | cache.t3.micro | ~$12 |
| CloudWatch | Logs & Metrics | ~$5 |
| **Total** | | **~$120-135/month** |

*Costs exclude data transfer and API usage (Blizzard, OpenAI)*

## Environment Variables in AWS

Store in **Secrets Manager**:
- `wow-api/blizzard/client-id`
- `wow-api/blizzard/client-secret`
- `wow-api/openai/api-key`

Store in **Parameter Store**:
- `/wow-api/region` - Blizzard region
- `/wow-api/port` - Application port

## Deployment Steps

1. Configure AWS credentials
2. Initialize Terraform: `terraform init`
3. Plan infrastructure: `terraform plan`
4. Apply changes: `terraform apply`
5. Build and push Docker image to ECR
6. Update ECS service with new task definition

## Auto Scaling Configuration

- **Target Tracking**: CPU utilization (70%)
- **Min tasks**: 2
- **Max tasks**: 10
- **Scale-out cooldown**: 60s
- **Scale-in cooldown**: 300s

## High Availability

- Multi-AZ deployment (minimum 2 AZs)
- ALB health checks every 30s
- ECS service auto-recovery
- RDS Multi-AZ (if enabled)
