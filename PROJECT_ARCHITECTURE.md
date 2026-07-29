# Ticket Management System — Architecture Document

## 1. Project Overview

A full-stack ticket management system with role-based access control, multi-language support (English / Dari / Pashto), real-time notifications, and analytical dashboards. The system supports three user roles — Admin, Support (various domains), and Organization/End Users — each with distinct permissions and interfaces.

---

## 2. Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Java | 21 | Runtime language |
| Spring Boot | 4.0.5 | Application framework |
| Spring Data JPA | — | ORM / database access |
| Spring Security 6 | — | Authentication & authorization |
| Spring Mail | — | Email (OTP, password reset) |
| Spring Actuator | — | Health checks, monitoring |
| Hibernate | — | JPA implementation |
| PostgreSQL | — | Primary database |
| HikariCP | — | Connection pooling (max 20, min idle 5) |
| Flyway | — | Schema migrations (12 migrations, applied at startup) |
| Bucket4j | — | API rate limiting (replaced with Redis-based) |
| JJWT (io.jsonwebtoken) | — | JWT token generation & validation |
| Lombok | — | Boilerplate reduction |
| OpenAPI / Swagger | — | API documentation |
| Logback | — | Logging (console dev, rolling file prod) |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.x | UI library |
| TypeScript | 5.9 | Type safety |
| Vite | 8.x | Build tool & dev server |
| Tailwind CSS | 4.x | Utility-first styling |
| React Router | 7.x | Client-side routing |
| Axios | 1.x | HTTP client |
| i18next / react-i18next | 26.x / 17.x | Internationalization |
| ApexCharts / react-apexcharts | 5.x / 2.x | Bar & pie charts |
| Recharts | 3.x | Donut/trend charts |
| PrimeReact | 10.x | UI components |
| PrimeIcons | 7.x | Icon library |
| Vitest | 4.x | Unit testing |
| React Paginate | 8.x | Pagination component |

---

## 3. Backend Architecture

### 3.1 Package Structure

```
com.ticket.ticket_system
  ├── TicketSystemApplication.java          # Main entry point
  ├── config/
  │   ├── DataInitializer.java              # Seeds admin role + admin user
  │   ├── OpenApiConfig.java                # Swagger documentation
  │   ├── RateLimitingConfig.java           # Bucket4j configuration  
  │   ├── SchemaMigration.java              # Runtime constraint migration
  │   ├── StartupValidator.java             # JWT secret validation (min 32 chars)
  │   └── WebConfig.java                    # Static resource serving
  ├── controller/
  │   ├── AuthController.java               # Login, signup, forgot/reset password
  │   ├── NotificationController.java       # User notifications CRUD
  │   ├── OrganizationController.java       # Organization CRUD + stats
  │   ├── RoleController.java               # Role CRUD
  │   ├── ServiceController.java            # Service CRUD
  │   ├── TestController.java               # Health / test
  │   ├── TicketController.java             # Ticket CRUD, assign, comments, dashboard, download
  │   └── UserController.java               # User CRUD, password, profile picture
  ├── dto/
  │   ├── AuthRequest.java                  # Login payload
  │   ├── AuthResponse.java                 # Login/signup response
  │   ├── SignupRequest.java                # Registration payload
  │   ├── UserResponseDTO.java              # User projection (flat strings)
  │   ├── TicketResponseDTO.java            # Ticket projection (flat strings)
  │   ├── ServiceResponseDTO.java           # Service projection
  │   ├── RoleResponseDTO.java              # Role projection
  │   ├── OrganizationResponseDTO.java      # Organization projection
  │   ├── NotificationResponseDTO.java      # Notification projection
  │   ├── CommentDTO.java                   # Comment with nested user
  │   ├── PageResponse.java                 # Generic pagination wrapper
  │   ├── DashboardDTO.java                 # Stats + recent + distribution
  │   ├── ForgotPasswordRequest.java        # Email for OTP
  │   ├── VerifyOTPRequest.java             # Email + OTP
  │   └── ResetPasswordRequest.java         # Email + OTP + new password
  ├── entity/
  │   ├── User.java                         # users table
  │   ├── Role.java                         # roles table
  │   ├── Organization.java                 # organizations table
  │   ├── Service.java                      # services table
  │   ├── Ticket.java                       # tickets table
  │   ├── Comment.java                      # comments table
  │   ├── Notification.java                 # notifications table
  │   ├── PasswordResetToken.java           # password_reset_tokens table
  │   └── AuditLog.java                     # audit_logs table
  ├── exception/
  │   └── GlobalExceptionHandler.java       # Centralized exception handling
  ├── repository/                           # Spring Data JPA interfaces
  ├── security/
  │   ├── SecurityConfig.java               # Filter chain, CORS, CSP, HSTS
  │   ├── JwtUtil.java                      # JWT generation & validation
  │   ├── JwtAuthenticationFilter.java       # Token extraction & auth setup
  │   ├── CustomUserDetailsService.java     # UserDetails loading
  │   └── RateLimitingFilter.java           # Rate limiter for auth endpoints
  └── service/
      ├── UserService.java
      ├── TicketService.java
      ├── ServiceService.java
      ├── RoleService.java
      ├── OrganizationService.java
      ├── NotificationService.java
      ├── PasswordResetService.java
      └── AuditLogService.java
```

### 3.2 Data Model (Entities & Relationships)

```
Role (1) ──< User (N)         # Each user has one role
Organization (1) ──< User (N) # Each user belongs to one org

Service (1) ──< Ticket (N)           # Each ticket is for one service
Organization (1) ──< Ticket (N)      # Each ticket belongs to one org
User (1) ──< Ticket.createdBy (N)    # Ticket creator
User (1) ──< Ticket.assignedTo (N)   # Ticket assignee (nullable)

Ticket (1) ──< Comment (N)           # Comments on a ticket
User (1) ──< Comment (N)             # Comment author

User (1) ──< Notification (N)       # Notifications for a user
Ticket (1) ──< Notification (N)     # Notification about a ticket (nullable)

Ticket (1) ──< AuditLog (N)         # Audit trail
```

### 3.3 Ticket States

```
PENDING ──→ IN_PROGRESS ──→ SOLVED
    ↑                           │
    └───────────────────────────┘ (reopen via status change)
```

- `PENDING`: Created, not yet assigned
- `IN_PROGRESS`: Assigned to a support user
- `SOLVED`: Marked as resolved (records `solvedAt` timestamp)

### 3.4 REST API Endpoints

#### Public Endpoints (no authentication)
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/test` | Test endpoint |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/signup` | Register (auto-inactive) |
| POST | `/api/auth/forgot-password` | Request OTP |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/roles/**` | List roles |
| GET | `/api/organizations/**` | List organizations |
| GET | `/uploads/**` | Static file serving |

#### Authenticated Endpoints

**Users** (`/api/users`)
| Method | Description |
|---|---|
| GET | Paginated list of all users |
| GET /{id} | Single user by ID |
| POST | Create user |
| PUT /{id} | Update user (non-admin: self only) |
| DELETE /{id} | Delete user (blocked if assigned to tickets) |
| POST /{id}/profile-picture | Upload profile image |
| PUT /{id}/password | Change password |
| GET /by-service/{serviceName} | Users by support service |

**Tickets** (`/api/tickets`)
| Method | Description |
|---|---|
| GET | Paginated all tickets |
| GET /{id} | Single ticket by ID |
| POST | Create ticket (with optional attachment) |
| PUT /{id} | Update ticket (with optional attachment) |
| DELETE /{id} | Delete ticket |
| POST /{ticketId}/assign/{userId} | Assign ticket → IN_PROGRESS |
| DELETE /{ticketId}/assign | Unassign → PENDING |
| PATCH /{id}/status | Change status |
| GET /organization/{orgId} | Tickets by org |
| GET /assigned/{userId} | Tickets assigned to user |
| GET /recent | Recent 5 tickets |
| GET /unassigned | Unassigned tickets |
| POST /{ticketId}/comments | Add comment |
| GET /{ticketId}/comments | Get comments |
| GET /{ticketId}/comments/count | Comment count |
| GET /dashboard | Dashboard stats + recent + service distribution |
| GET /statistics | Ticket statistics |
| GET /download/{ticketId} | Download attachment (permission-checked) |

**Services** (`/api/services`) — Full CRUD
**Roles** (`/api/roles`) — Full CRUD
**Organizations** (`/api/organizations`) — Full CRUD + stats

**Notifications** (`/api/notifications`)
| Method | Description |
|---|---|
| GET /user/{userId} | Paginated notifications |
| GET /unread/{userId} | Unread notifications |
| GET /count/{userId} | Unread count |
| PATCH /{id}/read | Mark single as read |
| PATCH /user/{userId}/read-all | Mark all as read |
| DELETE /{id} | Delete single |
| DELETE /user/{userId} | Delete all |

### 3.5 Notification Types

| Event | Type Enum | Recipients |
|---|---|---|
| Ticket created | `NEW_TICKET` | All admin users (roleId=1) |
| Ticket assigned | `ASSIGNMENT` | The assigned support user |
| Status changed | `STATUS_CHANGE` | Creator + all org users (skip duplicate creator) |
| Comment added | `NEW_COMMENT` | Creator + assigned user (skip commenter) |

### 3.6 Security Architecture

```
┌─────────────┐     ┌───────────────────────┐     ┌──────────────┐
│  Client      │────→│ RateLimitingFilter    │────→│ Auth Filter   │
│  (Browser)   │     │ (/api/auth/* only)    │     │ Chain         │
└─────────────┘     └───────────────────────┘     └──────┬───────┘
                                                          │
                                            ┌─────────────▼──────────┐
                                            │ JwtAuthenticationFilter │
                                            │ (extracts Bearer token) │
                                            └─────────────┬──────────┘
                                                          │
                                            ┌─────────────▼──────────┐
                                            │  SecurityContextHolder  │
                                            │  (ROLE_<role> authority)│
                                            └─────────────────────────┘
```

- **JWT**: HMAC-SHA256, 15min expiration, contains `sub` (userId), validated on every request
- **Password**: BCrypt-encoded, minimum 8 characters
- **Account Lockout**: 5 failed attempts → 15-minute lockout
- **Rate Limiting**: Redis-based sliding window, 10 requests/minute on auth endpoints, per IP via X-Real-IP header
- **CORS**: Restricted to `http://localhost:5173`, `http://localhost:5174`, `http://localhost:4173`, `https://*.mcitservices.af`
- **CSRF**: Disabled (stateless JWT via cookie with SameSite=Strict)
- **Session**: Stateless (no HTTP session)
- **Password Reset**: 6-digit OTP via email, 5-minute expiry, 3 attempt limit
- **Cookie Security**: `jwt-token` and `refresh-token` both HttpOnly, secure, SameSite=Strict
- **Actuator**: Prod only exposes `health` endpoint
- **File Upload**: Magic bytes validation, path traversal protection, 5MB limit
- **WebSocket**: JWT auth interceptor, origins restricted to localhost and mcitservices.af

### 3.7 Key Backend Configurations

| Property | Value | Notes |
|---|---|---|
| `spring.jpa.hibernate.ddl-auto` | `update` | Schema auto-managed |
| `spring.flyway.enabled` | `true` | 12 migrations, validated at startup |
| `spring.jpa.open-in-view` | `false` | Prevents LazyInitializationException |
| `jwt.secret` | Env var with dev fallback | ≥32 chars |
| `jwt.expiration` | 900000ms (15 min) | Token lifetime |
| `spring.servlet.multipart.max-file-size` | 5MB | File upload limit |
| `server.shutdown` | `graceful` | 30s timeout |

---

## 4. Frontend Architecture

### 4.1 File Structure

```
frontend/src/
  ├── App.tsx                    # Root component with routing
  ├── App.css                    # Global styles
  ├── index.css                  # Tailwind base styles
  ├── main.tsx                   # Entry point
  ├── vite-env.d.ts              # Vite type declarations
  ├── i18n.ts                    # i18next configuration (EN/FA/PS)
  ├── components/
  │   ├── Layout.tsx             # Main layout (sidebar + header)
  │   ├── Layout.css             # Layout styles
  │   ├── CommentModal.tsx       # Comment viewer
  │   ├── CommentModal.css       # Comment modal styles
  │   ├── SkeletonLoader.tsx     # Loading skeletons
  │   ├── SimpleToast.tsx        # Toast notification component
  │   └── ErrorBoundary.tsx      # Error boundary
  ├── contexts/
  │   ├── AuthContext.tsx         # Authentication state + methods
  │   └── NotificationContext.tsx # Notification polling + state
  ├── pages/
  │   ├── SignIn.tsx             # Login page
  │   ├── SignUp.tsx             # Registration page
  │   ├── ForgotPassword.tsx     # Forgot/reset password
  │   ├── AdminDashboard.tsx     # Admin dashboard (charts + stats)
  │   ├── ServiceManagement.tsx  # Service CRUD
  │   ├── CreateRole.tsx         # Role CRUD
  │   ├── CreateUser.tsx         # User CRUD + view modal
  │   ├── OrganizationManagement.tsx # Organization CRUD
  │   ├── TicketManagement.tsx   # Ticket management (admin)
  │   ├── SupportDashboard.tsx   # Support dashboard (charts + stats)
  │   ├── MyAssignTicket.tsx     # Support: assigned tickets
  │   ├── OrganizationDashboard.tsx # Org dashboard (stats)
  │   ├── MyTickets.tsx          # Org: ticket list + creation
  │   ├── Reports.tsx            # Admin reports
  │   └── Auth.css               # Shared auth page styles
  └── services/
      └── api.ts                 # Axios instance + typed API methods
```

### 4.2 Routing Structure

| Route | Component | Role | Description |
|---|---|---|---|
| `/signin` | SignIn | Public | Login |
| `/signup` | SignUp | Public | Register |
| `/forgot-password` | ForgotPassword | Public | Password reset |
| `/admin/dashboard` | AdminDashboard | ADMIN | Stats + charts |
| `/admin/services` | ServiceManagement | ADMIN | Service CRUD |
| `/admin/organizations` | OrganizationManagement | ADMIN | Org CRUD |
| `/admin/tickets` | TicketManagement | ADMIN | All tickets |
| `/admin/reports` | Reports | ADMIN | Reports generation |
| `/admin/create-role` | CreateRole | ADMIN | Role CRUD |
| `/admin/create-user` | CreateUser | ADMIN | User CRUD |
| `/support/dashboard` | SupportDashboard | ADMIN/SUPPORT | Support stats |
| `/support/my-tickets` | MyAssignTicket | ADMIN/SUPPORT | Assigned tickets |
| `/org/dashboard` | OrganizationDashboard | ORG/USER | Org stats |
| `/org/tickets` | MyTickets | ORG/USER | Org tickets |
| `/dashboard` | — (redirect) | Any | Redirects to role-based dashboard |
| `/` | — | Public | Redirects to /signin |

### 4.3 Component Hierarchy

```
<AuthProvider>
  <NotificationProvider>
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          ├── <SignIn />               # Standalone (no Layout)
          ├── <SignUp />               # Standalone (no Layout)
          ├── <ForgotPassword />       # Standalone (no Layout)
          └── <PrivateRoute>           # Wraps authenticated pages
              └── <Layout>
                  ├── <Sidebar>        # Navigation (role-aware)
                  ├── <TopNavbar>      # Language, notifications, profile
                  └── <Page />         # Content area
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </NotificationProvider>
</AuthProvider>
```

### 4.4 API Service Layer (`api.ts`)

Typed API modules organized by domain:
- `authAPI.login`, `authAPI.signup`, `authAPI.forgotPassword`, `authAPI.verifyOTP`, `authAPI.resetPassword`
- `userAPI.getAll`, `userAPI.create`, `userAPI.update`, `userAPI.delete`, `userAPI.changePassword`, `userAPI.updateProfilePicture`, `userAPI.getByService`
- `ticketAPI.getAll`, `ticketAPI.create`, `ticketAPI.update`, `ticketAPI.delete`, `ticketAPI.assign`, `ticketAPI.unassign`, `ticketAPI.updateStatus`, `ticketAPI.getByOrganization`, `ticketAPI.getAssigned`, `ticketAPI.getRecent`, `ticketAPI.getUnassigned`, `ticketAPI.addComment`, `ticketAPI.getComments`, `ticketAPI.getCommentCount`, `ticketAPI.getDashboard`, `ticketAPI.getStatistics`, `ticketAPI.downloadAttachment`
- `serviceAPI.getAll`, `serviceAPI.create`, `serviceAPI.update`, `serviceAPI.delete`
- `roleAPI.getAll`, `roleAPI.create`, `roleAPI.update`, `roleAPI.delete`
- `organizationAPI.getAll`, `organizationAPI.create`, `organizationAPI.update`, `organizationAPI.delete`, `organizationAPI.getStats`
- `notificationAPI.getNotifications`, `notificationAPI.getUnread`, `notificationAPI.getUnreadCount`, `notificationAPI.markAsRead`, `notificationAPI.markAllAsRead`, `notificationAPI.delete`, `notificationAPI.deleteAll`

Utility: `extractArrayData<T>()` — extracts typed array from `PageResponse<T>` wrapper or plain array.

### 4.5 State Management

| Context | State | Purpose |
|---|---|---|
| `AuthContext` | `user`, `isAuthenticated`, `loading` | Login state, role, token management |
| `NotificationContext` | `notifications`, `unreadCount` | 30-second polling for new notifications |

- No global state library (Redux, Zustand) — React Context + useState hooks suffice
- Each page manages its own data loading via `useRef` guards to prevent double-fetching
- `useSimpleToast` hook provides toast notifications

### 4.6 Localization (i18n)

- **Framework**: i18next + react-i18next
- **Languages**: English (en), Dari (fa), Pashto (ps)
- **Storage**: Language preference persisted in localStorage
- **Direction**: LTR for English, RTL for Dari/Pashto (document direction toggled)
- **Fallback**: English when a key is missing
- **Scope**: ~150+ translation keys covering navigation, actions, labels, statuses, errors
- **Location**: All translations defined inline in `i18n.ts` as 3 large objects (~1300 lines total)

### 4.7 Charts & Visualization

| Chart | Library | Location |
|---|---|---|
| Trend line chart | ApexCharts | AdminDashboard, SupportDashboard, Reports |
| Status distribution (donut) | Recharts | AdminDashboard, OrganizationDashboard, SupportDashboard |
| Service distribution (bar) | ApexCharts | AdminDashboard, SupportDashboard, Reports |
| Reports preview (bar) | ApexCharts | Reports |

### 4.8 Responsive Design

- **Framework**: Tailwind CSS breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
- **Mobile**: All pages responsive with:
  - Tables wrapped in `overflow-x-auto` for horizontal scroll
  - Action buttons use `shrink-0` to prevent uneven sizing
  - Pagination hides `<<`/`>>` on mobile (`hidden sm:inline-flex`)
  - Headers wrap on mobile (`flex-col sm:flex-row`)
  - Search inputs full-width on mobile (`w-full sm:w-48`)
  - Stats cards use reduced padding/icons (`p-3 sm:p-4`, `w-6 sm:w-9`)
  - Form grids switch to single column on mobile
- **Sidebar**: Slides in as overlay on mobile (hamburger toggle)
- **Auth pages**: Reduced card padding, smaller logo, single-column forms

---

## 5. Notification System

### 5.1 Flow

```
[Event occurs] → [NotificationService] → [Persist to DB] → [Frontend polls every 30s]
                                                              │
                                                     [NotificationContext]
                                                              │
                                                    [Bell icon shows badge]
                                                              │
                                              [Dropdown list with dismiss]
```

### 5.2 Events & Recipients

| Event | Triggered By | Recipients | Type |
|---|---|---|---|
| New ticket | `TicketService.createTicket()` | All admins | `NEW_TICKET` |
| Ticket assigned | `TicketService.assignTicket()` | Assigned user | `ASSIGNMENT` |
| Status changed | `TicketService.updateStatus()` | Creator + org users | `STATUS_CHANGE` |
| Comment added | `TicketService.addComment()` | Creator + assignee (skip commenter) | `NEW_COMMENT` |

### 5.3 Frontend Polling

- Polls `/notifications/unread/{userId}` every 30 seconds
- Unread count shown as red badge on bell icon
- Clicking a notification hides it from local state (WhatsApp-style dismissal)
- Unread count decremented on notification click

---

## 6. Security Architecture Summary

```
                    ┌──────────────────────────┐
                    │    Client (Browser)       │
                    │    localStorage: token    │
                    └────────────┬─────────────┘
                                 │ Authorization: Bearer <JWT>
                    ┌────────────▼─────────────┐
                    │  RateLimitingFilter       │
                    │  (Bucket4j, 10/min/IP)    │
                    │  /api/auth/* only         │
                    └────────────┬─────────────┘
                    ┌────────────▼─────────────┐
                    │  JwtAuthenticationFilter  │
                    │  - Extract Bearer token   │
                    │  - Parse JWT (HMAC-SHA)   │
                    │  - Set SecurityContext    │
                    │  - Authority: ROLE_<role> │
                    └────────────┬─────────────┘
                    ┌────────────▼─────────────┐
                    │  SecurityConfig           │
                    │  - Permit public paths    │
                    │  - /api/admin/* → ADMIN   │
                    │  - All /api/* → auth      │
                    │  - CORS, CSP, HSTS        │
                    │  - Stateless session      │
                    └────────────┬─────────────┘
                    ┌────────────▼─────────────┐
                    │  Controller Layer         │
                    │  @PreAuthorize checks     │
                    │  Manual role checks       │
                    │  Owner/self validation    │
                    └──────────────────────────┘
```

### Additional Security Measures
- **Password**: Min 8 chars, BCrypt-encoded
- **Account Lockout**: 5 failed attempts → 15-min lockout
- **JWT Secret**: Env var, ≥32 chars, dev-secret rejected at startup
- **File Upload**: 5MB max, content type validation
- **Attachment Download**: Permission check (owner, assignee, admin/support, same org)
- **Global Exception Handler**: No stack traces exposed to client
- **Actuator**: Secured, only health/info/readiness exposed

---

## 7. Frontend-Backend Data Flow

### 7.1 Paginated Lists

```
[Frontend]                      [Backend]
    │                               │
    │ GET /api/tickets?page=0&size=20
    │───────────────────────────────→
    │                               │ UserService.getAllUsers()
    │                               │ → userRepository.findAll(pageable)
    │                               │ → map User → UserResponseDTO
    │                               │
    │ 200 { data: [...],            │
    │   page: 0, size: 20,          │
    │   totalElements: 150,         │
    │   totalPages: 8 }             │
    │←───────────────────────────────
    │                               │
    │ extractArrayData()            │
    │ → typed User[] array          │
```

### 7.2 Flat DTO Pattern

Backend DTOs flatten all relationships into string+id pairs:
```json
{
  "role": "System Administrator",    // Role name as flat string
  "roleId": 1,                        // Role ID
  "organization": "Ministry of IT",  // Org name as flat string
  "organizationId": 2                 // Org ID
}
// Instead of:
{ "role": { "id": 1, "name": "..." }, "organization": { "id": 2, "name": "..." } }
```

---

## 8. Key Architectural Decisions

1. **Flat DTO pattern**: All entity relationships are resolved to `string + id` pairs in DTOs, avoiding circular serialization and making the frontend interface simple.

2. **JWT role from token**: The `JwtAuthenticationFilter` builds authorities directly from the JWT claim (not from the DB) to avoid a database query on every request. Role changes require token re-issuance.

3. **Hibernate DDL over Flyway**: Schema is managed by `ddl-auto=update` for development speed. Flyway SQL files exist but are disabled. A `SchemaMigration` component handles runtime constraint updates (e.g., notification enum changes).

4. **In-app notifications only**: No WebSocket/SSE. Frontend polls every 30 seconds. The `emailSent` flag exists on notifications but email delivery is not yet implemented.

5. **Local file storage**: Attachments and profile pictures stored on the local filesystem (`uploads/`). No cloud storage integration.

6. **Account lockout at controller level**: Not in the security filter chain. Implemented in `AuthController.login()` before authentication.

7. **In-memory rate limiting**: Bucket4j with `ConcurrentHashMap` — not distributed. Resets on application restart.

8. **Role-based routing**: Frontend uses `PrivateRoute` wrapper with `allowedRoles` prop. Role mismatch redirects to `/unauthorized` or `/signin`.

9. **Lazy loading**: All page components are lazy-loaded with `React.lazy` + `Suspense` for code splitting.

10. **useRef data guards**: All 10+ pages use `useRef` flags to prevent double data-fetching in React Strict Mode.
