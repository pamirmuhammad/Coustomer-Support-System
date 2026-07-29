# Ticket Management System

A full-stack, multi-tenant customer support ticket management system built for MCIT (Ministry of Communications and Information Technology of Afghanistan). Features role-based access control, real-time notifications, multi-language support (English, Dari, Pashto), and analytical dashboards.

---

## Table of Contents

- [Features](#features)
- [Technologies](#technologies)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Role-Based Access Control** — Admin, Support Staff (Email, Hosting, Server), and Client Organization roles with distinct permissions and dashboards
- **Ticket Lifecycle Management** — Create, assign, track, comment, and resolve support tickets with full status transitions
- **Real-Time Notifications** — WebSocket (STOMP) push for ticket events, with persistent database fallback and email delivery
- **Multi-Language UI** — English, Dari (دری), and Pashto (پښتو) with full RTL support
- **SLA Tracking** — Configurable response and resolution time thresholds with violation detection
- **Secure Authentication** — JWT with HttpOnly cookies, refresh token rotation, account lockout, and rate limiting
- **File Attachments** — Upload and download ticket attachments with magic bytes validation and pluggable storage (local or S3)
- **Email Notifications** — Welcome emails, password reset OTP, and ticket event notifications via SMTP
- **Analytics Dashboards** — Role-specific dashboards with charts, resolution rates, and aggregated statistics
- **Reports** — Government-themed PDF and CSV reports with ticket distribution data
- **Services & Organizations Management** — Full CRUD for service categories and client organizations
- **i18n** — Complete internationalization across all pages and components
- **Audit Logging** — Complete trail of all system actions for compliance and debugging

---

## Technologies

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 17+ | Runtime |
| Spring Boot | 4.0.5 | Application framework |
| Spring Security | — | Authentication & authorization |
| Spring Data JPA | — | Database ORM |
| Hibernate | 7.2 | Entity management |
| PostgreSQL | 17 | Primary database |
| Redis | 7 | Caching & rate limiting |
| Flyway | — | Database migrations (12 migrations) |
| JJWT | 0.12.5 | JWT token handling |
| BCrypt | — | Password hashing |
| Jakarta Mail | 2.1 | Email delivery |
| OpenAPI / Swagger | — | API documentation |
| Micrometer + Prometheus | — | Metrics & monitoring |
| Sentry | 8.9.0 | Error tracking |
| Resilience4j | — | Retry, circuit breaker |
| Testcontainers | — | Integration testing |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI library |
| TypeScript | — | Type safety |
| Vite | 8 | Build tool |
| Tailwind CSS | 4 | Utility-first styling |
| PrimeReact | 10 | UI component library |
| ApexCharts | — | Dashboard charts |
| Recharts | — | Pie charts |
| Axios | — | HTTP client |
| React Router | — | Client-side routing |
| i18next | — | Internationalization |
| WebSocket (STOMP) | — | Real-time notifications |

### DevOps

| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Nginx | Reverse proxy & static file serving |
| Let's Encrypt / Certbot | SSL/TLS certificates |
| GitHub Actions | CI/CD (optional) |

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│    Nginx     │────▶│   Frontend   │
│  (React SPA) │     │  (Port 80/   │     │  (Static     │
└─────────────┘     │   443 SSL)   │     │   Files)     │
                    │              │     └──────────────┘
                    │              │────▶┌──────────────┐
                    │              │     │   Backend    │
                    └──────────────┘     │  (Spring     │
                                         │   Boot :8080)│
                                         └──────┬───────┘
                                                │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                        ┌─────▼─────┐     ┌──────▼──────┐    ┌────▼────┐
                        │ PostgreSQL │     │    Redis     │    │  SMTP   │
                        │   (5432)   │     │   (6379)     │    │  Mail   │
                        └───────────┘     └─────────────┘    └─────────┘
```

---

## Project Structure

```
ticket-system/
├── src/main/java/com/ticket/ticket_system/
│   ├── config/              # Security, WebSocket, Cache, OpenAPI config
│   ├── controller/          # REST controllers (Auth, Ticket, User, etc.)
│   ├── dto/                 # Data Transfer Objects
│   ├── entity/              # JPA entities (User, Ticket, Organization, etc.)
│   ├── repository/          # Spring Data JPA repositories
│   ├── service/             # Business logic (Email, Notification, Password, etc.)
│   ├── security/            # JWT filter, authentication entry point
│   └── validation/          # Custom validators
├── src/main/resources/
│   ├── application.properties
│   ├── application-dev.properties
│   ├── application-prod.properties
│   └── db/migration/        # Flyway SQL migrations (V1–V12)
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   ├── components/      # Reusable UI components
│   │   ├── services/        # API client (Axios)
│   │   ├── hooks/           # Custom React hooks (WebSocket, etc.)
│   │   ├── i18n.ts          # Translations (EN, FA, PS)
│   │   └── utils/           # Helper utilities
│   ├── Dockerfile           # Multi-stage build (Node → Nginx)
│   └── nginx.conf           # Frontend Nginx config
├── nginx/nginx.conf         # Production reverse proxy config
├── Dockerfile               # Multi-stage build (Maven → JRE)
├── docker-compose.yml       # Full stack orchestration
├── pom.xml                  # Maven dependencies
└── .env.production          # Production environment template
```

---

## Getting Started

### Prerequisites

- Java 17+
- Node.js 20+
- PostgreSQL 17+
- Redis 7+ (optional, for caching)
- Maven 3.9+

### Local Development

**Backend:**
```bash
# Set environment variables
export DB_PASSWORD=your_password
export JWT_SECRET=your-32-char-minimum-secret

# Run
mvn spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`

### Docker (Full Stack)
```bash
docker compose up -d --build
```

---

## Deployment

The system is containerized and ready for deployment on any Linux server with Docker.

**Quick Deploy:**
```bash
# Clone
git clone https://github.com/pamirmuhammad/ticket-system.git
cd ticket-system

# Configure
cp .env.production .env
# Edit .env with your passwords and secrets

# Build & Start
docker compose build
docker compose up -d

# SSL Certificate
docker compose run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email support@mcitservices.af \
  --agree-tos --no-eff-email \
  -d support.mcitservices.af

# Restart with SSL
docker compose restart nginx
```

**Production URL:** [https://support.mcitservices.af](https://support.mcitservices.af)

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_URL` | Yes | `jdbc:postgresql://localhost:5432/ticket_system` | Database connection URL |
| `DB_USERNAME` | Yes | `postgres` | Database username |
| `DB_PASSWORD` | Yes | — | Database password |
| `JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRATION` | No | `900000` | Token expiry in ms (15 min) |
| `MAIL_HOST` | Yes | `smtp.gmail.com` | SMTP server host |
| `MAIL_PORT` | Yes | `587` | SMTP server port |
| `MAIL_USERNAME` | Yes | — | SMTP username |
| `MAIL_PASSWORD` | Yes | — | SMTP password |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `STORAGE_TYPE` | No | `local` | File storage type (`local` or `s3`) |
| `REDIS_HOST` | No | `localhost` | Redis host for caching |
| `SPRING_PROFILES_ACTIVE` | No | `dev` | Active Spring profile (`dev` or `prod`) |

---

## API Documentation

Once running, visit:
- **Swagger UI:** `http://localhost:8080/swagger-ui.html`
- **Health Check:** `http://localhost:8080/actuator/health`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/signup` | User registration |
| POST | `/api/v1/auth/forgot-password` | Request password reset OTP |
| GET | `/api/v1/tickets` | List tickets (role-scoped) |
| POST | `/api/v1/tickets` | Create a new ticket |
| PUT | `/api/v1/tickets/{id}/assign` | Assign ticket to support agent |
| PUT | `/api/v1/tickets/{id}/status` | Update ticket status |
| GET | `/api/v1/admin/dashboard-summary` | Admin dashboard statistics |
| GET | `/api/v1/notifications` | Get user notifications |
| WebSocket | `/ws` | Real-time notification stream |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MCIT License** — Copyright (c) 2026 Ministry of Communications and Information Technology, Islamic Republic of Afghanistan.

See [LICENSE](LICENSE) for full details.
