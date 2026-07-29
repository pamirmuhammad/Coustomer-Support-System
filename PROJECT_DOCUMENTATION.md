# Ticket Management System — Complete Documentation

## Table of Contents
1. [Technology Stack](#1-technology-stack)
2. [Project Architecture](#2-project-architecture)
3. [Backend Layer-by-Layer](#3-backend-layer-by-layer)
4. [Security Architecture](#4-security-architecture)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Caching Strategy](#8-caching-strategy)
9. [Real-Time Notifications](#9-real-time-notifications)
10. [File Storage](#10-file-storage)
11. [Observability](#11-observability)
12. [Deployment](#12-deployment)
13. [Testing Strategy](#13-testing-strategy)
14. [Profiles & Configuration](#14-profiles--configuration)

---

## 1. Technology Stack

### Backend

| Technology | Purpose | Version |
|---|---|---|
| **Java 21** | Runtime | 21 |
| **Spring Boot** | Application framework | 4.0.5 |
| **Spring WebMVC** | REST API layer | 7.0.6 |
| **Spring Security** | Authentication & authorization | (managed) |
| **Spring Data JPA** | ORM & database access | (managed) |
| **Spring Validation** | Bean validation (Jakarta) | (managed) |
| **Spring Cache** | Method-level caching abstraction | (managed) |
| **Spring WebSocket** | Real-time notification push | (managed) |
| **Spring Mail** | Email sending (password reset OTP) | (managed) |
| **PostgreSQL** | Primary database | 16+ |
| **Hibernate** | JPA implementation | (managed) |
| **Flyway** | Database migrations | (managed) |
| **Caffeine** | In-memory cache provider | (managed) |
| **Redis** | Rate limiting (only) | (managed) |
| **JJWT** | JWT token generation/validation | 0.12.5 |
| **Lombok** | Boilerplate reduction | (managed) |
| **AWS SDK S3** | Cloud file storage | 2.29.0 |
| **SpringDoc OpenAPI** | API documentation (Swagger UI) | 2.8.6 |
| **Micrometer** | Metrics collection | (managed) |
| **Prometheus** | Metrics exposition | (managed) |
| **Sentry** | Error tracking | 8.9.0 |
| **Resilience4j** | Circuit breakers, retries, bulkheads | 2.3.0 |
| **Logstash Logback** | Structured JSON logging | 8.1 |
| **TestContainers** | Integration test databases | 1.20.6 |
| **ArchUnit** | Architecture rule enforcement | 1.4.0 |
| **JaCoCo** | Code coverage | 0.8.12 |

### Frontend

| Technology | Purpose | Version |
|---|---|---|
| **React** | UI framework | 18.2 |
| **TypeScript** | Type-safe JavaScript | 5.9 |
| **Vite** | Build tool / dev server | 8.0 |
| **Axios** | HTTP client | 1.14 |
| **React Router** | Client-side routing | 7.14 |
| **PrimeReact** | UI component library | 10.8 |
| **Tailwind CSS** | Utility-first CSS | 4.2 |
| **React i18next** | Internationalization | 17.0 |
| **STOMP.js** | WebSocket client | 7.3 |
| **Recharts** | Charting library | 3.8 |
| **ApexCharts** | Alternative charting | 5.14 |
| **Sentry** | Error tracking | 9.12 |
| **Vitest** | Unit testing | 4.1 |
| **Testing Library** | Component testing | (latest) |

---

## 2. Project Architecture

### Overall Architecture: Layered Monolith with Clean Architecture Principles

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React SPA)                    │
│  Pages → Components → Services (Axios) → API Caching     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/WebSocket
┌──────────────────────┴──────────────────────────────────┐
│           Backend (Spring Boot 4.0.5)                    │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Controllers  │  │   Filters    │  │  WebSocket    │  │
│  │ (REST API)   │  │ (Auth, Rate, │  │  (STOMP)      │  │
│  │              │  │  Cache, Corr)│  │               │  │
│  └──────┬───────┘  └──────────────┘  └───────────────┘  │
│         │                                                 │
│  ┌──────┴──────────────────────────────────────────────┐ │
│  │              Service Layer                           │ │
│  │  Business logic, validation, orchestration           │ │
│  │  @Transactional, @Cacheable, @CacheEvict             │ │
│  └──────┬──────────────────────────────────────────────┘ │
│         │                                                 │
│  ┌──────┴──────────────────────────────────────────────┐ │
│  │           Repository Layer (Spring Data JPA)         │ │
│  └──────┬──────────────────────────────────────────────┘ │
│         │                                                 │
│  ┌──────┴──────────────────────────────────────────────┐ │
│  │         PostgreSQL / Redis / S3 / Filesystem         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Cross-cutting: Security, Cache, Audit, Observability │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Package Structure

```
com.ticket.ticket_system/
├── TicketSystemApplication.java      # Entry point
├── config/                           # Configuration classes
│   ├── CacheConfig.java              # Caffeine cache manager
│   ├── CacheControlFilter.java       # HTTP cache headers
│   ├── CorrelationIdFilter.java      # Request correlation IDs
│   ├── DataInitializer.java          # Seed data (admin user)
│   ├── DataSourceConfigurer.java     # HikariCP datasource
│   ├── OpenApiConfig.java            # Swagger/OpenAPI
│   ├── SchemaMigration.java          # Manual SQL patches
│   ├── StartupValidator.java         # Env var validation
│   ├── WebConfig.java                # Static resource serving
│   └── WebSocketConfig.java          # STOMP broker config
├── controller/                       # REST controllers
│   ├── AuthController.java           # /api/v1/auth/**
│   ├── DashboardController.java      # /api/v1/admin/dashboard-summary
│   ├── NotificationController.java   # /api/v1/notifications/**
│   ├── OrganizationController.java   # /api/v1/organizations/**
│   ├── RoleController.java           # /api/v1/roles/**
│   ├── ServiceController.java        # /api/v1/services/**
│   ├── TestController.java           # /api/v1/health, /test
│   ├── TicketController.java         # /api/v1/tickets/**
│   └── UserController.java           # /api/v1/users/**
├── dto/                              # Data Transfer Objects
│   ├── AuthRequest.java              # Login credentials
│   ├── AuthResponse.java             # Login/signup response
│   ├── SignupRequest.java            # Registration payload
│   ├── ForgotPasswordRequest.java    # Email only
│   ├── VerifyOTPRequest.java         # Email + OTP
│   ├── ResetPasswordRequest.java     # Email + OTP + new password
│   ├── RefreshTokenRequest.java      # Token refresh
│   ├── TicketResponseDTO.java        # Ticket view
│   ├── UserResponseDTO.java          # User view
│   ├── ServiceResponseDTO.java       # Service view
│   ├── RoleResponseDTO.java          # Role view
│   ├── OrganizationResponseDTO.java  # Org view
│   ├── NotificationResponseDTO.java  # Notification view
│   ├── CommentDTO.java               # Comment with user info
│   ├── DashboardDTO.java             # Dashboard stats
│   ├── DashboardSummaryDTO.java      # Aggregated admin data
│   └── PageResponse.java             # Generic paginated wrapper
├── entity/                           # JPA entities
│   ├── User.java                     # User accounts
│   ├── Ticket.java                   # Support tickets
│   ├── Service.java                  # Service categories
│   ├── Role.java                     # User roles
│   ├── Organization.java             # Organizations
│   ├── Comment.java                  # Ticket comments
│   ├── Notification.java             # User notifications
│   ├── AuditLog.java                 # Audit trail
│   ├── RefreshToken.java             # JWT refresh tokens
│   ├── PasswordResetToken.java       # Password reset OTPs
│   ├── SlaConfig.java                # SLA thresholds
│   └── SlaViolation.java             # SLA breach records
├── exception/                        # Error handling
│   └── GlobalExceptionHandler.java   # @RestControllerAdvice
├── repository/                       # Spring Data JPA repos
│   ├── UserRepository.java
│   ├── TicketRepository.java
│   ├── ServiceRepository.java
│   ├── RoleRepository.java
│   ├── OrganizationRepository.java
│   ├── CommentRepository.java
│   ├── NotificationRepository.java
│   ├── AuditLogRepository.java
│   ├── RefreshTokenRepository.java
│   ├── PasswordResetTokenRepository.java
│   ├── SlaConfigRepository.java
│   └── SlaViolationRepository.java
├── security/                         # Authentication & authorization
│   ├── SecurityConfig.java           # Filter chain, CORS, CSP
│   ├── JwtUtil.java                  # JWT creation & parsing
│   ├── JwtAuthenticationFilter.java  # Token extraction & validation
│   ├── CustomUserDetailsService.java # UserDetails loading
│   └── RateLimitingFilter.java       # Redis-based rate limiter
├── service/                          # Business logic
│   ├── TicketService.java            # Ticket CRUD, assignment, comments
│   ├── UserService.java              # User CRUD, password management
│   ├── ServiceService.java            # Service category CRUD
│   ├── RoleService.java              # Role CRUD
│   ├── OrganizationService.java      # Organization CRUD, stats
│   ├── NotificationService.java      # Notification creation & push
│   ├── AuditLogService.java          # Audit trail logging
│   ├── PasswordResetService.java     # OTP generation & verification
│   ├── RefreshTokenService.java      # Token rotation & revocation
│   ├── FileValidationService.java    # File type & name validation
│   ├── SlaService.java               # SLA violation detection
│   ├── RedisRateLimiter.java         # Rate limiting via Redis Lua
│   └── WebSocketNotificationSender.java # STOMP push
└── storage/                          # Pluggable storage
    ├── StorageService.java           # Interface
    ├── LocalStorageService.java      # Filesystem implementation
    └── S3StorageService.java         # AWS S3 implementation
```

---

## 3. Backend Layer-by-Layer

### 3.1 Controller Layer

Each controller is annotated with `@RestController`, `@RequestMapping("/api/v1/...")`, `@Tag` (Swagger), and `@RequiredArgsConstructor`. Methods have `@Operation` and `@ApiResponses` for API docs.

**Pattern:**
```
Controller → inject Service(s) → map HTTP request → delegate to Service → return DTO/ResponseEntity
```

Controllers do NOT contain business logic. They handle:
- Request validation (`@Valid`)
- HTTP status codes (`ResponseEntity`)
- Cookie management (`setTokenCookies`, `clearTokenCookies`)
- Response transformation (entity → DTO)

### 3.2 Service Layer

Services are annotated with `@Service` and `@Transactional`. Each service contains:
- CRUD operations with business validation
- Cache annotations (`@Cacheable`, `@CacheEvict`)
- `ResponseStatusException` for 4xx/5xx errors
- Audit logging where applicable

**Key algorithms:**

#### Authentication Flow (`AuthController + UserService`)
```
1. Login:
   - Lookup user by username or email
   - Check active status → reject if inactive
   - Check lockout time → reject if locked
   - Reset expired lockout
   - Spring Security AuthenticationManager.authenticate()
   - Reset failed attempts on success
   - Log audit event
   - Generate JWT (userId as subject, 15 min expiry)
   - Create refresh token (7 days, rotation-enabled)
   - Set HttpOnly cookies (jwt-token, refresh-token)
   - Return AuthResponse

2. Signup:
   - Validate username/email uniqueness
   - Encode password (BCrypt)
   - Set active=false (pending admin approval)
   - Prevent signup as ADMIN role
   - Generate tokens and set cookies
   - Return AuthResponse

3. Token Refresh:
   - Extract refresh token from cookie
   - Find token in DB
   - Verify not expired/revoked
   - Generate new refresh token (revoke old)
   - Generate new JWT
   - Set new cookies
   - Return AuthResponse

4. Logout:
   - Extract refresh token
   - Revoke all tokens for user
   - Clear cookies (maxAge=0)
```

#### Account Lockout Algorithm
```
failedLoginAttempts counter stored on User entity
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = 15 minutes

On failed login:
  increment failedLoginAttempts
  if failedLoginAttempts >= 5:
    set lockoutTime = now + 15 min

On successful login:
  reset failedLoginAttempts = 0
  reset lockoutTime = null

On login attempt while locked:
  check lockoutTime > now → reject with remaining minutes message
  if lockoutTime < now → reset and proceed
```

#### JWT Token Structure
```
Header:  { "alg": "HS256" }
Payload: { "sub": "userId", "iat": timestamp, "exp": timestamp }
Signature: HMAC-SHA256(encodedHeader + "." + encodedPayload, secret)
- Access token: 15 min expiry (stored in HttpOnly cookie)
- Uses JJWT library, HMAC-SHA with 256+ bit secret
- No role/permissions in token → live fetch from DB on every request
```

#### Password Reset with OTP
```
1. forgotPassword(email):
   - Generate 6-digit OTP
   - Rate limit: max 1 OTP per minute per email
   - Store OTP with 5-minute expiry in password_reset_tokens
   - Send email with OTP (async via Spring Mail)

2. verifyOTP(email, otp):
   - Find token by email + otp
   - Check not expired, not used
   - Check failedAttempts < 3 (lockout after 3 wrong attempts)
   - Mark as used
   - Return success

3. resetPassword(email, otp, newPassword):
   - Same verification as verifyOTP
   - Encode and update user password
   - Revoke all refresh tokens
   - Delete password reset token
```

#### Ticket Lifecycle
```
States: PENDING → IN_PROGRESS → SOLVED

1. Create: PENDING, unassigned, notify admins via WS
2. Assign: IN_PROGRESS, assignedTo=userId, notify assignee
3. Unassign: PENDING, assignedTo=null
4. Update Status: SOLVED → set solvedAt timestamp
5. Comment: Add to ticket, notify involved users
6. SLA: Check response/resolve time on status changes
```

### 3.3 Repository Layer

Uses Spring Data JPA with custom `@Query` annotations where needed. All repositories extend `JpaRepository<T, Long>`.

**Key query patterns:**
- Paginated queries (`Pageable` parameter)
- `@Modifying @Query` for bulk updates (photo, revoke tokens)
- `@Query` for aggregated counts (pending/in-progress/solved tickets)
- `existsBy*` for constraint checking before deletes
- `@EntityGraph` or `FetchType.EAGER` for relationships to avoid N+1

### 3.4 Entity Layer

Key design decisions:

| Entity | Key Fields | Relationships |
|---|---|---|
| **User** | username (unique), password (BCrypt), active, deleted (soft delete), failedLoginAttempts, lockoutTime | M:1 → Role, M:1 → Organization |
| **Ticket** | subject, description, status (enum), attachmentPath, solvedAt | M:1 → Service, M:1 → Organization, M:1 → User (createdBy), M:1 → User (assignedTo) |
| **AuditLog** | entityType, entityId, action, oldValue, newValue | (standalone, no FK relations) |

- Hard delete on `User`: permanent removal from DB; admin user and ADMIN role protected from deletion/role-change (403 FORBIDDEN)
- Refresh tokens use rotation: each refresh creates a new token and revokes the old one
- SLA violations are detected automatically on ticket status changes

---

## 4. Security Architecture

### 4.1 Authentication Flow

```
Request → CorrelationIdFilter → CacheControlFilter → RateLimitingFilter → JwtAuthenticationFilter → Controller
```

### 4.2 Filter Chain Details

| Filter | Order | Purpose |
|---|---|---|
| **CorrelationIdFilter** | 0 | Adds `X-Correlation-Id` header + MDC for log tracing |
| **CacheControlFilter** | 0 | Sets `Cache-Control: private, max-age=120` on dashboard-summary only (other endpoints get no cache headers) |
| **RateLimitingFilter** | 1 | Rate-limits `/api/v1/auth/**` to 10 req/60s per IP using Redis Lua script. Falls through on Redis failure (graceful degradation) |
| **JwtAuthenticationFilter** | (before UsernamePasswordAuthFilter) | Extracts JWT from `Authorization: Bearer` header OR `jwt-token` cookie, validates, fetches user from DB (live role + active check), sets SecurityContext |

### 4.3 JWT Strategy (Stateless)

```
Design Decision:
- Token stores ONLY userId (no roles, no permissions)
- Every request fetches the user from DB (Caffeine cached)
- This allows instant role changes / deactivation
- Trade-off: slightly slower (1 DB call per request) vs safer

Cookies:
- jwt-token: HttpOnly, secure, path=/, maxAge=15min, SameSite=Strict
- refresh-token: HttpOnly, secure, path=/api/v1/auth, maxAge=7days, SameSite=Strict
- SameSite=Strict + Secure prevents CSRF and cookie theft over HTTP
```

### 4.4 Authorization Rules

```
/api/v1/auth/**                → PERMIT ALL (anonymous)
/actuator/health/**            → PERMIT ALL (for k8s probes)
/swagger-ui/**, /v3/api-docs/**  → PERMIT ALL
/uploads/**                    → AUTHENTICATED (previously public)

GET /api/v1/roles/**           → PERMIT ALL (public data)
GET /api/v1/organizations/**   → PERMIT ALL
GET /api/v1/services/**        → PERMIT ALL

/api/v1/admin/**               → ROLE_ADMIN only
POST/PUT/DELETE roles/orgs     → ROLE_ADMIN only
POST/PUT/DELETE services       → ROLE_ADMIN only

/api/v1/users/**               → Authenticated
/api/v1/tickets/**             → Authenticated
/api/v1/notifications/**       → Authenticated
/api/v1/support/**             → Authenticated
/api/v1/organizations/**       → Authenticated

Everything else                → Authenticated
```

### 4.5 Password Security
- BCrypt password encoding (10 rounds)
- Minimum 8 characters
- Current password required for self-service password changes (admin bypasses old password check for force-password-change)
- Admin can force-reset without current password
- Failed attempt tracking with 5-attempt lockout (15 min)
- Password reset via email OTP (6 digits, 5 min expiry, 3 attempt limit)
- Force password change on first login: admin user redirected to `/force-password-change` (passwordChangeRequired flag)

---

## 5. Database Schema

### Entity Relationship Diagram (Logical)

```
User ──M:1── Role
User ──M:1── Organization
User ──1:M── Ticket (createdBy)
User ──1:M── Ticket (assignedTo)
User ──1:M── Notification
User ──1:M── RefreshToken
User ──1:M── AuditLog (performedBy)

Ticket ──M:1── Service
Ticket ──M:1── Organization
Ticket ──1:M── Comment
Ticket ──1:M── Notification
Ticket ──1:M── AuditLog
Ticket ──1:M── SlaViolation

Service ──1:1── SlaConfig

PasswordResetToken ── standalone (keyed by email)
```

### Key Indexes (Flyway V6)
- Tickets: `status`, `assigned_to_id`, `organization_id`, `created_by_id`, `created_at`
- Notifications: `user_id + is_read`, `created_at`
- Audit logs: `entity_type + entity_id`, `timestamp`
- Refresh tokens: `token` (unique), `user_id`
- Comments: `ticket_id`
- SLA violations: `ticket_id`

### Flyway Migrations
| Version | Description |
|---|---|
| V1-V2 | Baseline (skipped, `baseline-version=2`) |
| V3 | Core schema (users, roles, orgs, services, tickets, comments, notifications, audit_logs) |
| V4 | Extended audit log (entityType, entityId, oldValue, newValue) |
| V5 | SLA tracking (sla_configs, sla_violations) |
| V6 | Performance indexes |
| V7 | Refresh tokens, password reset tokens |
| V8 | Password reset failed attempts |
| V9 | Drop audit_logs.ticket_id FK constraint |
| V10 | Add index on tickets (created_at, status) |
| V11 | Add assigned_at column to tickets |
| V12 | Add password_change_required column to users |

---

## 6. API Reference

### Authentication Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Login with username/email + password | None |
| POST | `/api/v1/auth/signup` | Register new account (inactive until approved) | None |
| POST | `/api/v1/auth/forgot-password` | Request password reset OTP | None |
| POST | `/api/v1/auth/verify-otp` | Verify OTP code | None |
| POST | `/api/v1/auth/reset-password` | Reset password with verified OTP | None |
| POST | `/api/v1/auth/refresh` | Rotate refresh token, get new JWT | Refresh cookie |
| POST | `/api/v1/auth/logout` | Revoke tokens, clear cookies | Cookie |
| GET | `/api/v1/auth/me` | Get current user profile | JWT cookie |

### Admin Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/admin/dashboard-summary` | Aggregated dashboard stats (total users, orgs, services, ticket distribution) |

### Ticket Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/tickets` | List tickets (paginated) |
| GET | `/api/v1/tickets/{id}` | Get ticket details |
| POST | `/api/v1/tickets` | Create ticket (multipart, with optional attachment) |
| PUT | `/api/v1/tickets/{id}` | Update ticket (JSON or multipart) |
| DELETE | `/api/v1/tickets/{id}` | Delete ticket |
| PATCH | `/api/v1/tickets/{id}/status` | Update ticket status |
| POST | `/api/v1/tickets/{ticketId}/assign/{userId}` | Assign ticket |
| DELETE | `/api/v1/tickets/{ticketId}/assign` | Unassign ticket |
| GET | `/api/v1/tickets/organization/{orgId}` | List by organization |
| GET | `/api/v1/tickets/assigned/{userId}` | List by assignee |
| GET | `/api/v1/tickets/unassigned` | Unassigned tickets |
| GET | `/api/v1/tickets/recent` | Recent tickets |
| GET | `/api/v1/tickets/statistics` | Ticket stats by status |
| GET | `/api/v1/tickets/dashboard` | Dashboard data |
| POST | `/api/v1/tickets/{ticketId}/comments` | Add comment |
| GET | `/api/v1/tickets/{ticketId}/comments` | Get comments |
| GET | `/api/v1/tickets/{ticketId}/comments/count` | Comment count |
| GET | `/api/v1/tickets/download/{ticketId}` | Download attachment |

### User Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/users` | List users (paginated) |
| GET | `/api/v1/users/{id}` | Get user details |
| POST | `/api/v1/users` | Create user (admin) |
| PUT | `/api/v1/users/{id}` | Update user |
| DELETE | `/api/v1/users/{id}` | Soft-delete user |
| POST | `/api/v1/users/{id}/profile-picture` | Upload profile photo |
| PUT | `/api/v1/users/{id}/password` | Change password |
| GET | `/api/v1/users/by-service/{serviceName}` | Users by service role |

### Service / Role / Organization Endpoints

| Method | Path | Description |
|---|---|---|
| CRUD | `/api/v1/services/**` | Service category management |
| CRUD | `/api/v1/roles/**` | Role management |
| CRUD | `/api/v1/organizations/**` | Organization management |
| GET | `/api/v1/organizations/{id}/stats` | Org statistics |

### Notification Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/notifications/user/{userId}` | List notifications (paginated) |
| GET | `/api/v1/notifications/unread/{userId}` | Unread notifications |
| GET | `/api/v1/notifications/count/{userId}` | Unread count |
| PATCH | `/api/v1/notifications/{id}/read` | Mark as read |
| PATCH | `/api/v1/notifications/user/{userId}/read-all` | Mark all as read |
| DELETE | `/api/v1/notifications/{id}` | Delete notification |

### Health / Utility

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/test` | Connection test |

### Actuator Endpoints (dev profile)

| Path | Description |
|---|---|
| `/actuator/health` | Health (with details in dev) |
| `/actuator/info` | Application info |
| `/actuator/prometheus` | Metrics for Prometheus scraping |
| `/actuator/readiness` | Readiness probe |

---

## 7. Frontend Architecture

### 7.1 Structure

```
frontend/src/
├── pages/            # Route-level components
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks
├── contexts/         # React contexts (Auth, Notification)
├── services/         # API client, cache, utilities
└── utils/            # Helper functions
```

### 7.2 Page Components & Routes

| Route | Component | Description |
|---|---|---|
| `/signin` | `SignIn.tsx` | Login form |
| `/signup` | `SignUp.tsx` | Registration form |
| `/forgot-password` | `ForgotPassword.tsx` | Password reset flow |
| `/admin/dashboard` | `AdminDashboard.tsx` | Admin stats & charts |
| `/admin/users` | `CreateUser.tsx` | User management (CRUD + activate/deactivate) |
| `/admin/services` | `ServiceManagement.tsx` | Service CRUD |
| `/admin/roles` | `CreateRole.tsx` | Role CRUD |
| `/admin/organizations` | `OrganizationManagement.tsx` | Org CRUD |
| `/admin/reports` | `Reports.tsx` | Reports & analytics |
| `/tickets` | `TicketManagement.tsx` | Full ticket management (admin) |
| `/admin/my-tickets` | `AdminMyTickets.tsx` | Admin's own created tickets |
| `/my-tickets` | `MyTickets.tsx` | User's created tickets |
| `/my-assign-ticket` | `MyAssignTicket.tsx` | Tickets assigned to user |
| `/organization/dashboard` | `OrganizationDashboard.tsx` | Org-level dashboard |
| `/support/dashboard` | `SupportDashboard.tsx` | Support dashboard |

### 7.3 Data Flow

```
Page Component 
  → calls API function (from api.ts)
    → apiCache.fetch() checks in-memory TTL cache
      → cache miss → Axios HTTP request → backend
    → cache hit → return cached data
  → updates component state
  → renders UI
```

### 7.4 State Management

- **Authentication**: `AuthContext` (React Context) — stores current user, provides login/logout/signup actions
- **Notifications**: `NotificationContext` (React Context) — connects to WebSocket, provides unread count
- **Page-level state**: `useState` in each page component (no global store like Redux)
- **Caching**: `apiCache` singleton — in-memory cache with per-key TTL and in-flight request deduplication

### 7.5 API Cache Strategy

```
Cache Keys:     'users', 'roles', 'services', 'organizations'
Cache TTLs:     users=5min, roles=15min, services=15min, orgs=15min, dashboard=2min
Invalidation:   After create/update/delete operations (via apiCache.invalidate)
                On tab focus (visibilitychange event)
                After authAPI.signup

In-Flight Dedup: Concurrent requests for same key share one promise
                Prevents duplicate API calls during the same render cycle
```

### 7.6 Internationalization

- 3 languages: English (en), Dari (fa), Pashto (ps)
- React i18next for translation
- Translation files stored in `public/locales/{lang}/translation.json`

---

## 8. Caching Strategy

### Backend Caching (Caffeine)

```
Cache Name    | TTL     | Max Size | Usage
──────────────┼─────────┼──────────┼─────────────────────
roles         | 1 hour  | 1000     | RoleService.getRoleById()
services      | 1 hour  | 1000     | ServiceService.getServiceById()
organizations | 30 min  | 1000     | OrganizationService.getOrganizationById()
users         | 5 min   | 1000     | UserService.getUserById()
```

- `@Cacheable` on read methods
- `@CacheEvict(allEntries=true)` on create/update/delete
- `LoggingCacheErrorHandler` — logs cache errors as warnings (never throws)
- Cache metrics recorded via `.recordStats()` for Micrometer exposure

### Frontend Caching (In-Memory)

- Singleton `ApiCache` class (plain TypeScript, no external library)
- TTL-based expiry per cache key
- In-flight request deduplication prevents parallel duplicate calls
- Invalidation on CUD operations + tab focus
- No cross-tab synchronization (per-browser-tab isolation)

---

## 9. Real-Time Notifications

### Architecture

```
Backend → STOMP over WebSocket → Frontend

1. Event occurs (new ticket, assignment, comment, status change)
2. NotificationService.createNotification() called
3. Creates DB record + calls WebSocketNotificationSender.sendToUser()
4. STOMP broker pushes to /topic/notifications/{userId}
5. Frontend useWebSocket hook receives message
6. NotificationContext updates unread count
```

### WebSocket Configuration

- Endpoint: `/ws` (SockJS enabled)
- Broker: `/topic` (simple broker)
- Application prefix: `/app`
- Frontend connects via `@stomp/stompjs` with SockJS transport
- Auth: JWT Bearer token validated via WebSocketAuthInterceptor on CONNECT
- Origins: Restricted to `http://localhost:*` and `https://*.mcitservices.af`

---

## 10. File Storage

### Pluggable Storage Service (`StorageService` interface)

| Implementation | Storage Type | Config |
|---|---|---|
| `LocalStorageService` | Local filesystem (`uploads/` directory) | `app.storage.type=local` (default) |
| `S3StorageService` | AWS S3 bucket | `app.storage.type=s3` + AWS env vars |

### File Validation (`FileValidationService`)

```
Extensions allowed: pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, txt, csv, zip
MIME type validation: checked against allowed list
Magic bytes validation: checks file header bytes match expected signatures (JPEG: FF D8 FF, PNG: 89 50 4E 47, PDF: 25 50 44 46, ZIP: 50 4B 03 04, etc.)
File renaming: UUID_originalname.ext (preserves original name)
Image validation: jpeg/png/gif only for profile photos
Path traversal protection: resolveSafePath() normalizes and validates path stays within upload directory
```

---

## 11. Observability

### Structured Logging (Profle: prod)

- JSON format via Logstash Logback Encoder
- Correlation IDs in MDC (from `X-Correlation-Id` header or generated UUID)
- Rolling file appender (50MB per file, 14 days history, 500MB total cap)
- Error-only rolling file (10MB per file, 30 days history)

### Metrics (Prometheus + Micrometer)

- Exposed at `/actuator/prometheus` (dev profile)
- JVM metrics (memory, threads, GC)
- HTTP request metrics (count, duration, status)
- Cache metrics (Caffeine hit/miss/eviction rates)
- Resilience4j metrics (circuit breaker state, retry counts)

### Error Tracking (Sentry)

- Backend: `sentry-logback` appender → ERROR level events to Sentry (when `SENTRY_DSN` env var is set)
- Frontend: `@sentry/react` wraps `<App>` in `Sentry.ErrorBoundary`

### Health Checks

- `/actuator/health` — liveness probe
- `/actuator/readiness` — readiness probe (Kubernetes)
- Docker HEALTHCHECK — polls `/actuator/health` every 30s

---

## 12. Deployment

### Docker Setup

```
Dockerfile (multi-stage build):
  Stage 1: maven:3.9-eclipse-temurin-17 → mvn package
  Stage 2: eclipse-temurin:17-jre → copy JAR, non-root user, HEALTHCHECK
```

### docker-compose.yml
```yaml
Services:
  - postgres:17-alpine (named volume, health check)
  - app: built from Dockerfile (depends on postgres healthy)
Volumes: postgres_data, uploads, logs
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | 8080 | HTTP port |
| `SPRING_PROFILES_ACTIVE` | dev | Active profile |
| `DB_URL` | jdbc:postgresql://localhost:5432/ticket_system | JDBC URL |
| `DB_USERNAME` | postgres | DB user |
| `DB_PASSWORD` | (required, no fallback) | DB password |
| `JWT_SECRET` | local-dev-only-not-for-prod... (dev fallback) | HMAC secret (min 32 chars) |
| `JWT_EXPIRATION` | 900000 | JWT TTL (ms, 15 min) |
| `CORS_ALLOWED_ORIGINS` | http://localhost:5173 | CORS origins |
| `STORAGE_TYPE` | local | File storage type |
| `AWS_ACCESS_KEY_ID` | — | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | — | S3 secret key |
| `AWS_S3_BUCKET` | — | S3 bucket name |
| `SENTRY_DSN` | — | Sentry DSN |
| `MAIL_HOST` | smtp.gmail.com | SMTP server |
| `MAIL_PORT` | 587 | SMTP port |
| `MAIL_USERNAME` | — | SMTP username |
| `MAIL_PASSWORD` | — | SMTP password |
| `OPENAPI_SERVER_URL` | http://localhost | Swagger server URL |

### Kubernetes

Manifests in `k8s/`:
- `namespace.yaml` — Dedicated namespace
- `configmap.yaml` — Non-sensitive env vars
- `secret.yaml` — DB password, JWT secret, S3 credentials
- `deployment.yaml` — 2 replicas, liveness/readiness probes, resource limits
- `service.yaml` — ClusterIP service
- `ingress.yaml` — nginx ingress with path routing
- `hpa.yaml` — Horizontal Pod Autoscaler (CPU 70%, Memory 80%, 2–10 replicas)

### CI/CD (GitHub Actions)

```
.github/workflows/deploy.yml:
  - Build with TestContainers + PostgreSQL service
  - Run tests + JaCoCo check
  - Build Docker image
  - Push to Docker Hub
```

---

## 13. Testing Strategy

### Backend Tests

| Test Class | Type | Count | Dependencies |
|---|---|---|---|
| `AuthControllerTest` | Unit (MockMvc standalone) | 8 | JUnit + Mockito |
| `TicketServiceTest` | Unit | 16 | JUnit + Mockito |
| `UserServiceTest` | Unit | 20 | JUnit + Mockito |
| `RefreshTokenServiceTest` | Unit | 7 | JUnit + Mockito |
| `TicketRepositoryTest` | Integration (TestContainers) | 11 | TestContainers + PostgreSQL |
| `UserRepositoryTest` | Integration (TestContainers) | 10 | TestContainers + PostgreSQL |
| `AuthIntegrationTest` | Integration (TestContainers) | 9 | TestContainers + PostgreSQL |
| `ArchitectureTest` | ArchUnit | 6 | ArchUnit |

**Coverage threshold:** 70% instruction, 60% branch (JaCoCo)

### Frontend Tests

| Test | Description |
|---|---|
| `api.test.ts` | API service unit tests |
| `ErrorBoundary.test.tsx` | Error boundary component tests |

### Test Infrastructure

- `AbstractIntegrationTest.java` — Base class for integration tests (PostgreSQL TestContainers, `@SpringBootTest`, `@ActiveProfiles("test")`)
- `application-test.properties` — Hibernate ddl-auto=create-drop, Flyway disabled, Redis repos disabled
- Tests can be run without Docker for unit tests (51 tests), Docker required for integration tests

---

## 14. Profiles & Configuration

### Profile Overview

| Profile | Profile File | Use Case |
|---|---|---|
| `dev` (default) | `application-dev.properties` | Development: verbose SQL, DEBUG logging, full actuator (health, info, readiness, prometheus), show-details=always |
| `prod` | `application-prod.properties` | Production: WARN logging, actuator only health+info, no details exposed |
| `test` | `application-test.properties` | Testing: create-drop DDL, Flyway disabled |

### Configuration Files

| File | Purpose |
|---|---|
| `application.properties` | Shared settings: datasource, JWT, file upload, CORS, caching, etc. |
| `application-dev.properties` | Dev overrides |
| `application-prod.properties` | Prod overrides |
| `application-resilience.yml` | Resilience4j circuit breakers (TicketService, UserService), retries (DB), bulkheads |
| `logback-spring.xml` | Logging: dev → console, prod → JSON (stdout + rolling files) + Sentry |
| `sonar-project.properties` | SonarQube analysis config |
| `.github/workflows/deploy.yml` | CI/CD pipeline |

### Key Configuration Properties

```properties
# Active profile (default)
spring.profiles.active=dev

# OpenAPI server URL
app.openapi.server-url=http://localhost:8080

# JWT
jwt.secret=${JWT_SECRET}
jwt.expiration=${JWT_EXPIRATION:900000}

# CORS
app.cors.allowed-origins=${CORS_ALLOWED_ORIGINS:http://localhost:5173}

# File upload
app.upload.dir=${file.upload-dir:uploads}
app.storage.type=${STORAGE_TYPE:local}

# Redis
spring.data.redis.repositories.enabled=false

# Server
server.forward-headers-strategy=framework
```
