# Ticket System — Complete Deployment Guide

## Prerequisites
- Ubuntu Server with SSH access
- Domain `support.mcitservices.af` pointed to server IP
- Your project files available (via git or zip)

---

## Step 1: SSH into the Server
```bash
ssh support@103.132.98.177 -p 2031
```

---

## Step 2: Update System Packages
```bash
sudo apt update -y
sudo apt upgrade -y
```

---

## Step 3: Install Docker & Docker Compose
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose-plugin
```

---

## Step 4: Add User to Docker Group
```bash
sudo usermod -aG docker $USER
exit  # Then SSH back in
```

---

## Step 5: Clone / Copy Project Files
```bash
mkdir -p /opt/ticket-system
cd /opt/ticket-system
# Either git clone or upload zip and extract
```

---

## Step 6: Create Environment Configuration
```bash
cat > .env << 'EOF'
JWT_SECRET=change-this-to-a-long-random-string-at-least-32-chars
DB_USERNAME=postgres
DB_PASSWORD=Admin123@
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
STORAGE_TYPE=local
EOF
```

**JWT_SECRET must be at least 32 characters.**

---

## Step 7: Create Required Directories
```bash
mkdir -p uploads
```
Note: `logs/` volume was removed — app logs go to stdout via `docker logs`.

---

## Step 8: Build and Start All Services
```bash
docker compose up -d --build
```

This starts 5 containers:
1. **postgres** — PostgreSQL database
2. **redis** — Redis for rate limiting
3. **app** — Spring Boot backend
4. **frontend** — Nginx serving React SPA
5. **nginx** — Reverse proxy routing to app + frontend

---

## Step 9: Fix Frontend SPA Routing (404 on page routes)
```bash
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
# The frontend nginx.conf is now copied during build and includes try_files
```

---

## Step 10: Set Up SSL with Let's Encrypt
```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d support.mcitservices.af

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## Step 11: Update nginx.conf with SSL
```bash
sudo tee /opt/ticket-system/nginx/nginx.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name support.mcitservices.af;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name support.mcitservices.af;

    ssl_certificate /etc/letsencrypt/live/support.mcitservices.af/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/support.mcitservices.af/privkey.pem;

    client_max_body_size 5M;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/ {
        proxy_pass http://app:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://app:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /actuator/health {
        proxy_pass http://app:8080;
    }
}
EOF

docker compose up -d --build nginx
```

---

## Step 12: Set Up SSL Auto-Renewal Crontab
```bash
sudo crontab -e
# Add:
0 3 * * * /usr/bin/certbot renew --quiet && docker compose -f /opt/ticket-system/docker-compose.yml exec nginx nginx -s reload
```

---

## Step 13: Verify the Deployment
```bash
# Check all containers are running
docker compose ps

# Check app logs for startup success
docker compose logs app --tail=50

# Check the admin password was generated (first startup only)
docker compose logs app | grep "Generated admin password"
```

---

## Accessing Your System

| Service | URL |
|---------|-----|
| Application | https://support.mcitservices.af |
| API | https://support.mcitservices.af/api/v1/... |
| Health Check | https://support.mcitservices.af/actuator/health |

### Default Login Credentials
- **Username:** admin
- **Password:** Randomly generated and printed in logs on first startup
  - Find it with: `docker compose logs app | grep "Generated admin password"`

On a fresh database, admin is redirected to `/force-password-change` on first login.

---

## Useful Management Commands

```bash
# View running containers
docker compose ps

# View application logs
docker compose logs app --tail=50

# Follow logs in real-time
docker compose logs -f app

# Restart services
docker compose restart app

# Stop everything
docker compose down

# Stop everything and delete database (fresh start)
docker compose down -v

# Rebuild and restart a single service
docker compose up -d --build frontend

# Database backup
docker exec -t ticket-system-db pg_dump -U postgres ticket_system > backup_$(date +%Y%m%d).sql

# Database restore
cat backup_20250623.sql | docker exec -i ticket-system-db psql -U postgres ticket_system
```

---

## Architecture Summary

```
Browser → https://support.mcitservices.af:443
                │
          Nginx Reverse Proxy (port 443, SSL)
                │
        ┌───────┴───────┐
        │               │
   / → frontend    /api/ → app:8080
   (React SPA)     (Spring Boot)
                        │
               ┌────────┴────────┐
               │                 │
          PostgreSQL          Redis
          (database)        (rate limiter)
```
