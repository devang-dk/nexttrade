# Docker Compose Setup Guide for NexTrade

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 1.29+)

## Quick Start

### 1. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values (API keys, secrets, etc.)
```

### 2. Start All Services

```bash
# Build and start all services in the background
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **MongoDB**: mongodb://localhost:27017
- **Redis**: redis://localhost:6379
- **Prometheus**: http://localhost:9090

## Services

### MongoDB (nextrade-mongodb)
- **Port**: 27017
- **Default Credentials**: admin / password
- **Database**: nexttrade
- **Volume**: `mongodb_data` (persistent)

### Backend (nextrade-backend)
- **Port**: 8080
- **Language**: Node.js + Express
- **Environment**: Development with nodemon hot reload
- **Dependencies**: MongoDB, Redis

### Frontend (nextrade-frontend)
- **Port**: 3000
- **Technology**: React
- **Build**: Multi-stage Docker build
- **Volume**: `./client/src` (hot reload in development)

### Redis (nextrade-redis)
- **Port**: 6379
- **Purpose**: Caching, real-time data, sessions
- **Volume**: `redis_data` (persistent)

### Prometheus (nextrade-prometheus)
- **Port**: 9090
- **Config**: `./prometheus.yml`
- **Purpose**: Metrics collection and monitoring

## Common Commands

### View Container Status
```bash
docker-compose ps
```

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Volumes (Delete All Data)
```bash
docker-compose down -v
```

### Rebuild Services
```bash
docker-compose up --build
```

### Rebuild Specific Service
```bash
docker-compose up --build backend
```

### Access Backend Container Shell
```bash
docker-compose exec backend sh
```

### Access MongoDB Shell
```bash
docker-compose exec mongodb mongosh -u admin -p password nexttrade
```

### View Backend Logs
```bash
docker-compose logs -f backend
```

### View Frontend Logs
```bash
docker-compose logs -f frontend
```

## Development Workflow

### Hot Reload Setup

The services are configured with volumes for hot reload:

- **Backend**: `./server:/app` - Changes to server code auto-restart with nodemon
- **Frontend**: `./client/src:/app/src` - Changes to React code auto-refresh

Just edit your code, save, and the containers will reload automatically!

### Environment Variables in Production

For production deployment, update the `.env` file with:

```env
NODE_ENV=production
JWT_SECRET=your-production-secret-key
CORS_ORIGIN=https://yourdomain.com
MONGO_PASSWORD=strong-production-password
```

Then rebuild and restart:
```bash
docker-compose down
docker-compose up -d --build
```

## Troubleshooting

### MongoDB Connection Error
```bash
# Check MongoDB logs
docker-compose logs mongodb

# Verify MongoDB is running
docker-compose exec mongodb mongosh -u admin -p password
```

### Backend Can't Connect to MongoDB
- Ensure MongoDB container is healthy: `docker-compose ps`
- Check connection string in backend logs
- Verify credentials in `.env` match docker-compose.yml

### Frontend Can't Connect to Backend
- Ensure backend is running and healthy
- Check REACT_APP_API_URL in browser console
- Verify CORS settings in backend

### Port Already in Use
```bash
# Change port mapping in docker-compose.yml
# For example, change "3000:3000" to "3001:3000"
```

### Clear Everything and Start Fresh
```bash
docker-compose down -v
docker system prune
docker-compose up -d --build
```

## Monitoring

### View Prometheus Metrics
1. Open http://localhost:9090
2. Select metrics from the dropdown
3. Click "Execute" to view real-time data

### Common Metrics to Monitor
- CPU usage: `container_cpu_usage_seconds_total`
- Memory usage: `container_memory_usage_bytes`
- Network I/O: `container_network_io_bytes_total`

## Production Deployment

For production, consider:

1. Use a reverse proxy (nginx)
2. Set up SSL/TLS certificates
3. Use strong passwords and secrets
4. Store secrets in a secrets manager (not .env)
5. Use separate .env files for each environment
6. Set resource limits in docker-compose.yml
7. Use a container registry (Docker Hub, ECR, etc.)

Example production configuration:
```yaml
services:
  backend:
    # ... other config ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Support

For issues or questions, check:
- Docker logs: `docker-compose logs`
- Service health: `docker-compose ps`
- Container inspect: `docker inspect <container_id>`
