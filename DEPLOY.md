# 🛡️ ShieldNet Deployment Guide

## Quick Start (Development)

```bash
# 1. Clone the repo
git clone https://github.com/hhhashexe/agent-challenge.git
cd agent-challenge

# 2. Install dependencies
pnpm install

# 3. Configure environment (already pre-filled with Nosana endpoints)
cp .env.example .env

# 4. Run in development mode with hot reload
export PATH="/tmp/bun-install/node_modules/.bin:$PATH"  # If bun not installed globally
pnpm dev
```

Open http://localhost:3000 to interact with ShieldNet.

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# Build the image
docker build -t shieldnet-elizaos:latest .

# Run the container
docker run -p 3000:3000 \
  --env-file .env \
  -v shieldnet-data:/app/data \
  shieldnet-elizaos:latest
```

**With Docker Compose:**

```yaml
version: '3.8'
services:
  shieldnet:
    image: shieldnet-elizaos:latest
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - shieldnet-data:/app/data
    restart: unless-stopped
    networks:
      - default

volumes:
  shieldnet-data:
```

```bash
docker-compose up -d
```

### Option 2: Nosana GPU Network

Deploy on decentralized infrastructure powered by Nosana:

```bash
# Install Nosana CLI
npm install -g @nosana/cli

# Configure your Nosana account
nosana auth login

# Deploy ShieldNet using the job definition
nosana job post --file nos_job_def/shieldnet.json --market gpu

# Monitor the deployment
nosana job logs <job-id>
```

The job definition automatically:
- Pulls the latest ShieldNet Docker image
- Configures the Qwen3.5-27B endpoint
- Exposes port 3000 for agent interaction
- Runs on Nosana's decentralized GPU network

**Benefits:**
- ✅ Privacy-first (your data, your control)
- ✅ Decentralized inference (not cloud-dependent)
- ✅ Cost-effective GPU access
- ✅ No setup complexity

### Option 3: Kubernetes (Enterprise)

```bash
# Create namespace
kubectl create namespace shieldnet

# Create secrets
kubectl create secret generic shieldnet-secrets \
  --from-literal=OPENAI_API_KEY=nosana \
  --from-literal=OPENAI_API_URL=<your-endpoint> \
  --from-literal=OPENAI_EMBEDDING_URL=<your-endpoint> \
  -n shieldnet

# Deploy
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shieldnet
  namespace: shieldnet
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shieldnet
  template:
    metadata:
      labels:
        app: shieldnet
    spec:
      containers:
      - name: shieldnet
        image: shieldnet-elizaos:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: shieldnet-secrets
        env:
        - name: SERVER_PORT
          value: "3000"
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: shieldnet
  namespace: shieldnet
spec:
  selector:
    app: shieldnet
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
EOF

# Monitor
kubectl logs -f deployment/shieldnet -n shieldnet
```

## Environment Variables

**Required:**
```bash
# Nosana LLM Endpoint
OPENAI_API_KEY=nosana
OPENAI_API_URL=https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1
MODEL_NAME=Qwen3.5-27B-AWQ-4bit

# Nosana Embedding Endpoint
OPENAI_EMBEDDING_URL=https://4yiccatpyxx773jtewo5ccwhw1s2hezq5pehndb6fcfq.node.k8s.prd.nos.ci/v1
OPENAI_EMBEDDING_API_KEY=nosana
OPENAI_EMBEDDING_MODEL=Qwen3-Embedding-0.6B
OPENAI_EMBEDDING_DIMENSIONS=1024

# Server Configuration
SERVER_PORT=3000
```

**Optional:**
```bash
# Social Integrations
TELEGRAM_BOT_TOKEN=<your-bot-token>
DISCORD_API_TOKEN=<your-bot-token>
TWITTER_USERNAME=<your-username>
TWITTER_PASSWORD=<your-password>
TWITTER_EMAIL=<your-email>

# Database (default: ./data/db.sqlite)
SQLITE_DATA_DIR=./data

# Node Environment (default: production)
NODE_ENV=production
```

## Monitoring & Health Checks

### Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 3600,
  "agent": "ShieldNet",
  "version": "1.0.0"
}
```

### Logs

**Docker:**
```bash
docker logs -f <container-id>
```

**Kubernetes:**
```bash
kubectl logs -f deployment/shieldnet -n shieldnet
```

**Local:**
```bash
pnpm start 2>&1 | tee shieldnet.log
```

## Scaling

### Horizontal Scaling (Multiple Instances)

**Docker Swarm:**
```bash
docker service create \
  --name shieldnet \
  --replicas 3 \
  -p 3000:3000 \
  --env-file .env \
  shieldnet-elizaos:latest
```

**Kubernetes:**
```bash
kubectl scale deployment/shieldnet --replicas=3 -n shieldnet
```

### Load Balancing

Use a load balancer (nginx, HAProxy, or K8s ingress) to distribute traffic:

```nginx
upstream shieldnet {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    server_name security.example.com;

    location / {
        proxy_pass http://shieldnet;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Issue: "Scan API returned 503"

**Cause:** ShieldNet API (scan.bughunt.tech) is temporarily unavailable

**Solution:**
- Check https://status.bughunt.tech
- Retry after 5-10 minutes
- Contact Hash Security support

### Issue: "Failed to load character"

**Cause:** Invalid character.json or missing plugins

**Solution:**
```bash
# Validate character
cat characters/agent.character.json | jq .

# Reinstall plugins
pnpm install
```

### Issue: "Connection refused" on port 3000

**Cause:** Server didn't start or wrong port

**Solution:**
```bash
# Check if port is in use
lsof -i :3000

# Try a different port
SERVER_PORT=3001 pnpm start
```

### Issue: "Model not found: Qwen3.5-27B"

**Cause:** Nosana endpoint is down or API key is invalid

**Solution:**
```bash
# Verify endpoint is reachable
curl -X POST https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3.5-27B-AWQ-4bit",
    "messages": [{"role": "user", "content": "test"}]
  }'

# Fallback: Use local Ollama
ollama pull qwen3.5:27b
# Update .env:
OPENAI_API_URL=http://127.0.0.1:11434/v1
```

## Performance Tuning

### Optimize for Latency

```bash
# Reduce model size (trade accuracy for speed)
MODEL_NAME=Qwen3.5-7B  # Smaller variant

# Disable embeddings if not needed
# (Remove OPENAI_EMBEDDING_* variables)
```

### Optimize for Throughput

```bash
# Run multiple instances with load balancer (see Scaling section)
# Use connection pooling
# Enable caching of scan results
```

### Memory & CPU

```bash
# Monitor resource usage
docker stats

# Limit resources (Docker)
docker run -m 2g --cpus="2" shieldnet-elizaos:latest

# Limit resources (Kubernetes - see K8s section above)
```

## Backup & Recovery

```bash
# Backup database
docker cp <container-id>:/app/data/db.sqlite ./backups/db.sqlite.backup

# Restore from backup
docker cp ./backups/db.sqlite.backup <container-id>:/app/data/db.sqlite
docker restart <container-id>
```

## Updating ShieldNet

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker build -t shieldnet-elizaos:latest .

# Restart container
docker-compose up -d --build
```

## Support

- **Bug Reports:** https://github.com/hhhashexe/agent-challenge/issues
- **Security Issues:** security@bughunt.tech
- **Community:** https://discord.gg/shieldnet (coming soon)
