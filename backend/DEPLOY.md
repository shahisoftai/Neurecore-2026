# NeureCore Backend — Production Deployment Guide

## Prerequisites on Server (✓ Already Verified on guvhq.shahisoft.store)
- ✓ Docker 29.2.1
- ✓ Docker Compose v5.0.2
- ✓ Node.js 20.20.0
- ✓ nginx 1.24.0
- ✓ 11 GB RAM, 63 GB free disk
- ✓ Domain: guvhq.shahisoft.store → 109.123.248.253

---

## 📦 Deployment Steps

### 1️⃣ **Prepare Environment**

SSH into your server:
```bash
ssh root@109.123.248.253
```

Install pnpm (optional, for manual builds):
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Create deployment directory:
```bash
mkdir -p /opt/neurecore/backend
cd /opt/neurecore/backend
```

### 2️⃣ **Upload Backend Code**

From your local machine, sync the backend folder:
```bash
# Option A: rsync (recommended)
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.env' \
  ./backend/ root@109.123.248.253:/opt/neurecore/backend/

# Option B: Git (if using a repo)
ssh root@109.123.248.253
cd /opt/neurecore/backend
git clone <your-repo-url> .
```

### 3️⃣ **Configure Environment**

On the server:
```bash
cd /opt/neurecore/backend

# Copy production env template
cp .env.production .env

# Generate JWT secret
openssl rand -hex 32

# Edit .env and fill in:
nano .env
```

**Required changes in `.env`:**
- `POSTGRES_PASSWORD` — set a strong password
- `REDIS_PASSWORD` — set a strong password
- `JWT_SECRET` — paste the output from `openssl rand -hex 32`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — (optional) add if using AI features

### 4️⃣ **Deploy with Docker Compose**

```bash
cd /opt/neurecore/backend

# Build and start all services (Postgres + Redis + Backend)
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### 5️⃣ **Run Database Migrations**

```bash
cd /opt/neurecore/backend

# Wait for services to be healthy (check with `docker ps`)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# (Optional) Seed initial data
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

If you need to create a super admin user:
```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed:admin
# Or manually via Prisma Studio:
docker compose -f docker-compose.prod.yml exec backend npx prisma studio
```

### 6️⃣ **Configure nginx as Reverse Proxy**

Create nginx site config:
```bash
nano /etc/nginx/sites-available/neurecore-backend
```

Paste this configuration:
```nginx
# Backend API + Socket.IO
upstream neurecore_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.guvhq.shahisoft.store;

    # Backend API
    location /api/ {
        proxy_pass http://neurecore_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://neurecore_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://neurecore_backend/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable site and restart nginx:
```bash
ln -s /etc/nginx/sites-available/neurecore-backend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 7️⃣ **Set Up SSL with Let's Encrypt**

```bash
# Install certbot if not present
apt update && apt install -y certbot python3-certbot-nginx

# Generate SSL certificate
certbot --nginx -d api.guvhq.shahisoft.store

# Auto-renewal is configured by default via cron
```

After SSL setup, nginx will automatically update the config to use HTTPS.

---

## 🔍 Verification

### Check all services are running:
```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                  STATUS              PORTS
neurecore_backend     Up (healthy)        0.0.0.0:3000->3000/tcp
neurecore_postgres    Up (healthy)        0.0.0.0:5432->5432/tcp
neurecore_redis       Up (healthy)        0.0.0.0:6379->6379/tcp
```

### Test API endpoint:
```bash
# Via nginx (HTTP, before SSL)
curl http://api.guvhq.shahisoft.store/api/health

# Via nginx (HTTPS, after SSL)
curl https://api.guvhq.shahisoft.store/api/health

# Direct to container
curl http://localhost:3000/api/health
```

Expected response: `{"status":"ok"}` or similar

### Check logs:
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend

# Last 50 lines
docker compose -f docker-compose.prod.yml logs --tail=50 backend
```

---

## 🔄 Updates & Maintenance

### Pull latest code and rebuild:
```bash
cd /opt/neurecore/backend
git pull  # or rsync from local
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Restart services:
```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Stop all services:
```bash
docker compose -f docker-compose.prod.yml down
```

### Stop and remove volumes (⚠️ DELETES DATA):
```bash
docker compose -f docker-compose.prod.yml down -v
```

### View resource usage:
```bash
docker stats
```

---

## 🐛 Troubleshooting

### Backend won't start:
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Common issues:
# - DATABASE_URL incorrect → check .env
# - Postgres not ready → wait 30s, check `docker ps`
# - JWT_SECRET missing → ensure it's set in .env
```

### Database connection errors:
```bash
# Test Postgres connection
docker compose -f docker-compose.prod.yml exec postgres psql -U neurecore -d neurecore_prod -c "SELECT 1;"

# Reset database (⚠️ DELETES DATA)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Socket.IO not connecting:
```bash
# Check nginx WebSocket headers
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://api.guvhq.shahisoft.store/socket.io/

# Verify backend is listening on 3000
ss -tlnp | grep 3000
```

---

## 📊 Monitoring

### Container health:
```bash
watch -n 5 'docker compose -f docker-compose.prod.yml ps'
```

### Disk usage:
```bash
df -h
docker system df
```

### Clean up unused Docker resources:
```bash
docker system prune -a --volumes
```

---

## 🔐 Security Checklist

- ✅ Strong passwords in `.env` (Postgres, Redis)
- ✅ JWT_SECRET is random 64+ char string
- ✅ SSL/TLS enabled via Certbot
- ✅ Firewall allows only 80/443/22 (not 3000, 5432, 6379 externally)
- ✅ `.env` file has `600` permissions: `chmod 600 .env`
- ⚠️ Consider: Fail2ban, UFW firewall rules, Docker container resource limits

---

## 🌐 Frontend Configuration

Update frontend `.env` files to point to your API:

**Tenant Frontend:**
```env
NEXT_PUBLIC_API_URL=https://api.guvhq.shahisoft.store/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.guvhq.shahisoft.store
```

**Admin Frontend:**
```env
NEXT_PUBLIC_API_URL=https://api.guvhq.shahisoft.store/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.guvhq.shahisoft.store
```

Deploy frontends to Vercel with these environment variables set in project settings.

---

## ✅ Production Checklist

- [ ] `.env` configured with strong secrets
- [ ] Database migrations run successfully
- [ ] Backend health endpoint returns 200
- [ ] nginx reverse proxy configured
- [ ] SSL certificate installed
- [ ] Firewall rules configured
- [ ] Frontends deployed and pointing to API
- [ ] Socket.IO connections working
- [ ] Logs are clean (no errors)
- [ ] Backup strategy in place for Postgres data

---

**Need help?** Check logs first: `docker compose -f docker-compose.prod.yml logs -f backend`
