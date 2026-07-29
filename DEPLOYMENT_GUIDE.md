# Ticket System — Linux Deployment Guide

## Prerequisites

- A Linux server (Ubuntu 22.04/24.04 recommended) with root or sudo access
- Domain `support.mcitservices.af` pointed to your server IP
- SSH client (e.g., Terminal on Mac/Linux, PowerShell on Windows)

## Quick Start

```bash
# Connect
ssh support@103.132.98.177 -p 2031

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose-plugin
sudo usermod -aG docker $USER

# Log out and back in, then:
mkdir -p /opt/ticket-system && cd /opt/ticket-system
# Upload or git clone your project here

# Create env file
cat > .env << 'EOF'
JWT_SECRET=your-long-random-secret-at-least-32-characters
DB_USERNAME=postgres
DB_PASSWORD=strong-database-password
STORAGE_TYPE=local
EOF

# Build and start
docker compose up -d --build
```

## Step-by-Step

### 1. Connect to Your Server
```bash
ssh support@103.132.98.177 -p 2031
```

### 2. Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose-plugin
sudo usermod -aG docker $USER
```
Log out and back in for docker group to take effect.

### 3. Get the Project Files

**Option A: Git clone**
```bash
cd /opt
git clone <your-repo-url> ticket-system
cd ticket-system
```

**Option B: Upload via SCP (from local machine)**
```powershell
# On Windows PowerShell:
cd "C:\path\to\ticket-system"
scp -P 2031 -r * support@103.132.98.177:/opt/ticket-system/
```

### 4. Create Environment File
```bash
cd /opt/ticket-system
cat > .env << 'EOF'
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
DB_USERNAME=postgres
DB_PASSWORD=strong-database-password-change-me
STORAGE_TYPE=local
EOF
```

### 5. Build and Start Everything
```bash
docker compose up -d --build
```

This starts: postgres, redis, app, frontend, nginx (reverse proxy).

### 6. Set Up SSL with Let's Encrypt
```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (follow interactive prompts)
sudo certbot --nginx -d support.mcitservices.af

# Test auto-renewal
sudo certbot renew --dry-run

# Add to crontab for daily renewal at 3am
sudo crontab -e
# Add: 0 3 * * * /usr/bin/certbot renew --quiet && docker compose -f /opt/ticket-system/docker-compose.yml exec nginx nginx -s reload
```

### 7. Rebuild nginx with SSL Config
```bash
docker compose up -d --build nginx
```

### 8. Access the System
```
https://support.mcitservices.af
```

**Default admin credentials:**
- Username: `admin`
- Password: randomly generated and printed in startup logs
  ```bash
  docker compose logs app | grep "Generated admin password"
  ```

On first login, admin is redirected to change their password.

## Architecture

```
Browser → https://support.mcitservices.af
                │
          Nginx (SSL termination)
                │
        ┌───────┴───────┐
        │               │
   /api/v1/*        /* (static)
        │               │
    app:8080       frontend:80
   (Spring Boot)   (nginx serving React)
        │
   ┌────┴────┐
   │         │
PostgreSQL  Redis
  (data)   (rate limiting)
```

## Container Details

| Container | Image | Port | Healthcheck |
|-----------|-------|------|-------------|
| postgres | postgres:17-alpine | 5432 | `pg_isready` every 10s |
| redis | redis:7-alpine | 6379 | `redis-cli ping` every 10s |
| app | Custom (Dockerfile) | 8080 | `/actuator/health` every 30s |
| frontend | Custom (frontend/Dockerfile) | 80 | — |
| nginx | nginx:alpine-slim | 443/80 | — |

## Key Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | Yes | Min 32 chars, no default fallback in prod |
| `DB_PASSWORD` | Yes | No fallback (was `Admin123@`, now required) |
| `DB_USERNAME` | No | Default: postgres |
| `STORAGE_TYPE` | No | local or s3 |
| `SENTRY_DSN` | No | Error tracking |
| `MAIL_USERNAME` | If email | SMTP username for password reset |
| `MAIL_PASSWORD` | If email | SMTP password |

## Useful Commands

```bash
# Status
docker compose ps

# Logs
docker compose logs -f app

# Rebuild single service
docker compose up -d --build frontend

# Stop all
docker compose down

# Fresh start (delete DB)
docker compose down -v

# Database backup
docker exec -t ticket-system-db pg_dump -U postgres ticket_system > backup.sql

# Database restore
cat backup.sql | docker exec -i ticket-system-db psql -U postgres ticket_system
```

## Troubleshooting

**App fails to start**
```bash
docker compose logs app
```
Common causes: missing JWT_SECRET (< 32 chars), wrong DB_PASSWORD, DB not healthy yet.

**Cannot connect on port 80/443**
```bash
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
# Stop conflicting services:
sudo systemctl stop apache2
sudo systemctl stop nginx  # host nginx, not container
```

**Server reboot**
Containers have `restart: unless-stopped`, so they start automatically after reboot.
```bash
docker compose ps  # Verify
```
