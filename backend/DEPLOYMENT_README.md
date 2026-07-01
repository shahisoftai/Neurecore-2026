# 🚀 NeureCore Backend — Production Deployment Package

This package contains everything you need to deploy NeureCore backend to your Contabo VPS at `guvhq.shahisoft.store`.

## 📦 Files Included

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production Docker Compose configuration (Postgres + Redis + Backend) |
| `.env.production` | Production environment template (copy to `.env` and customize) |
| `Dockerfile` | Multi-stage Docker build for backend (optimized with pnpm) |
| `DEPLOY.md` | Comprehensive deployment guide with all commands and troubleshooting |
| `deploy.sh` | Automated deployment script for quick setup |

## ⚡ Quick Start (5 minutes)

### Option A: Automated Deployment (Recommended)

1️⃣ **Upload to server:**
```bash
rsync -avz --exclude 'node_modules' --exclude 'dist' \
  ./backend/ root@109.123.248.253:/opt/neurecore/backend/
```

2️⃣ **SSH into server and run deployment script:**
```bash
ssh root@109.123.248.253
cd /opt/neurecore/backend

# Make script executable
chmod +x deploy.sh

# Run automated setup (generates secrets, copies .env)
./deploy.sh setup

# Build and start services
./deploy.sh build
./deploy.sh up

# Run database migrations
./deploy.sh migrate

# Check health
./deploy.sh health
```

3️⃣ **Done!** Your backend is now running at `http://109.123.248.253:3000`

---

### Option B: Manual Deployment

1️⃣ **Upload & configure:**
```bash
# From local machine
rsync -avz --exclude 'node_modules' ./backend/ root@109.123.248.253:/opt/neurecore/backend/

# SSH to server
ssh root@109.123.248.253
cd /opt/neurecore/backend

# Setup environment
cp .env.production .env
openssl rand -hex 32  # Copy this output
nano .env  # Paste JWT_SECRET and set passwords
```

2️⃣ **Deploy:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

3️⃣ **Verify:**
```bash
curl http://localhost:3000/api/health
```

---

## 🌐 Configure nginx Reverse Proxy

**Create nginx config:**
```bash
nano /etc/nginx/sites-available/neurecore-backend
```

**Paste this configuration:**
```nginx
upstream neurecore_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.guvhq.shahisoft.store;

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
    }

    location /socket.io/ {
        proxy_pass http://neurecore_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

**Enable and restart nginx:**
```bash
ln -s /etc/nginx/sites-available/neurecore-backend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

**Add SSL with Let's Encrypt:**
```bash
certbot --nginx -d api.guvhq.shahisoft.store
```

---

## ✅ Post-Deployment Checklist

- [ ] Services running: `./deploy.sh status`
- [ ] Health check passes: `./deploy.sh health`
- [ ] nginx reverse proxy configured
- [ ] SSL certificate installed
- [ ] Firewall allows only 80/443/22 (block 3000, 5432, 6379 externally)
- [ ] Database migrations completed
- [ ] Logs are clean: `./deploy.sh logs`
- [ ] Frontend environment variables updated to point to `https://api.guvhq.shahisoft.store`

---

## 🔧 Common Commands

```bash
# View logs
./deploy.sh logs

# Restart backend
./deploy.sh restart

# Check status
./deploy.sh status

# Stop everything
./deploy.sh down

# Rebuild after code changes
git pull  # or rsync new code
./deploy.sh build
./deploy.sh up
./deploy.sh migrate
```

---

## 📚 Documentation

- **Full deployment guide:** See `DEPLOY.md`
- **Environment variables:** See `.env.production` for all options
- **Docker Compose config:** See `docker-compose.prod.yml`
- **Troubleshooting:** See `DEPLOY.md` → Troubleshooting section

---

## 🆘 Support

If deployment fails:

1. Check logs: `./deploy.sh logs`
2. Verify `.env` has all required values (JWT_SECRET, passwords, etc.)
3. Ensure ports 80/443/3000 are not blocked by firewall
4. Check service health: `docker compose -f docker-compose.prod.yml ps`
5. See `DEPLOY.md` for detailed troubleshooting steps

---

## 🔐 Security Notes

- ✅ Generated `.env` uses strong random passwords
- ✅ Dockerfile runs as non-root user (`nestjs`)
- ✅ Health checks enabled on all services
- ⚠️ **IMPORTANT:** Set firewall rules to block external access to 3000, 5432, 6379
- ⚠️ Use strong passwords for database and Redis
- ⚠️ Enable SSL via Certbot before going live

---

## 🎯 Next Steps

After backend is deployed:

1. **Deploy frontends to Vercel:**
   - Tenant: Update `NEXT_PUBLIC_API_URL=https://api.guvhq.shahisoft.store/api/v1`
   - Admin: Update `NEXT_PUBLIC_API_URL=https://api.guvhq.shahisoft.store/api/v1`

2. **Configure DNS:**
   - `tenant.guvhq.shahisoft.store` → Vercel (tenant frontend)
   - `admin.guvhq.shahisoft.store` → Vercel (admin frontend)
   - `api.guvhq.shahisoft.store` → 109.123.248.253 (backend)

3. **Update backend CORS in `.env`:**
   ```
   TENANT_FRONTEND_URL=https://tenant.guvhq.shahisoft.store
   ADMIN_FRONTEND_URL=https://admin.guvhq.shahisoft.store
   ```

---

**Deployment package ready! 🚀**

Start with: `./deploy.sh setup`
