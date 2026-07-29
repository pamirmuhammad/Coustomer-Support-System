# Ticket Management System — Module Documentation

## Table of Contents

1. [Authentication Module](#1-authentication-module)
2. [User Management Module](#2-user-management-module)
3. [Ticket Management Module](#3-ticket-management-module)
4. [Service Management Module](#4-service-management-module)
5. [Organization Management Module](#5-organization-management-module)
6. [Role Management Module](#6-role-management-module)
7. [Notification Module](#7-notification-module)
8. [Audit Logging Module](#8-audit-logging-module)
9. [File Upload Module](#9-file-upload-module)
10. [SLA Tracking Module](#10-sla-tracking-module)
11. [Dashboard Module](#11-dashboard-module)
12. [Password Reset Module](#12-password-reset-module)
13. [Caching Module](#13-caching-module)
14. [Rate Limiting Module](#14-rate-limiting-module)
15. [WebSocket Module](#15-websocket-module)
16. [Observability Module](#16-observability-module)
17. [Storage Module](#17-storage-module)
18. [Testing Module](#18-testing-module)
19. [Deployment Module](#19-deployment-module)

---

## 1. Authentication Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.AuthController` |
| **Base Path** | `/api/v1/auth` |
| **Key Files** | `AuthController.java`, `SecurityConfig.java`, `JwtUtil.java`, `JwtAuthenticationFilter.java`, `CustomUserDetailsService.java`, `RateLimitingFilter.java` |
| **Frontend** | `SignIn.tsx`, `SignUp.tsx`, `AuthContext.tsx` |
| **Database Tables** | `users`, `refresh_tokens`, `audit_logs` |

### Overview

The Authentication Module is the system's gateway. It manages user identity verification, session handling, and account security. It provides login, registration, token refresh, and logout capabilities. The module implements a **stateless JWT authentication** model where tokens are stored in HttpOnly cookies rather than localStorage, providing protection against XSS attacks.

### Functional Capabilities

#### 1.1 User Login (`POST /api/v1/auth/login`)
The login process accepts a username or email along with a password. It performs multi-layered validation:
1. **Username/Email Resolution** — The system first attempts to find the user by username. If not found, it retries using email. This dual-lookup approach supports both login methods seamlessly.
2. **Account Status Check** — If the account is inactive (pending admin approval or deactivated), the system rejects the request with a specific message: "Your account has not been activated yet. Please wait for administrator approval."
3. **Lockout Check** — If the account has been locked due to excessive failed attempts, the system rejects the request with the remaining lockout time: "Account is locked. Try again in X minutes."
4. **Authentication** — Spring Security's `AuthenticationManager` validates the credentials against the BCrypt-hashed password.
5. **Success Processing** — On successful authentication:
   - Failed login attempts counter is reset to 0
   - Lockout time is cleared if it existed
   - An audit log entry ("LOGIN_SUCCESS") is created
   - A new JWT access token (15-minute expiry) is generated containing only the user's ID
   - A new refresh token (7-day expiry, one-time use) is created
   - Both tokens are set as HttpOnly cookies on the response
   - An `AuthResponse` containing user profile data is returned

#### 1.2 User Registration (`POST /api/v1/auth/signup`)
The registration process creates a new user account:
1. **Validation** — The request payload is validated for required fields (fullName, username, password, email) and constraints (username: 3-50 chars, password: 8+ chars).
2. **Uniqueness Checks** — Both username and email are checked against existing records. Duplicates are rejected with appropriate error messages.
3. **Role Assignment** — If a role is specified, it is loaded from the database. The ADMIN role is explicitly blocked from self-registration (returns 403).
4. **Organization Assignment** — If an organization is specified, it is loaded from the database.
5. **Account Creation** — The user is created with `active=false` (pending admin approval), the password is BCrypt-encoded, and the record is persisted.
6. **Audit Logging** — A "SIGNUP" audit entry is recorded.
7. **Token Generation** — Despite the inactive status, JWT and refresh tokens are generated and set as cookies (the user can see their profile but cannot access most features until activated).
8. **Cache Invalidation** — The frontend `users` cache is invalidated so the admin user list immediately reflects the new account.

#### 1.3 Token Refresh (`POST /api/v1/auth/refresh`)
The refresh endpoint implements **token rotation** — a security best practice:
1. **Token Extraction** — The refresh token is extracted from the `refresh-token` cookie.
2. **Lookup** — The token is looked up in the `refresh_tokens` database table.
3. **Validation** — The token is checked for expiry and revocation status.
4. **Rotation** — If valid, the old token is revoked and a new refresh token is created. The new token has a fresh 7-day expiry window.
5. **New JWT** — A new 15-minute JWT access token is generated.
6. **Response** — Both new tokens are set as cookies, and the user profile is returned.

#### 1.4 Logout (`POST /api/v1/auth/logout`)
The logout process:
1. **Token Extraction** — The refresh token is extracted from the cookie.
2. **Revocation** — ALL refresh tokens associated with the user are revoked (bulk revoke), ensuring the user is logged out from all sessions/devices.
3. **Cookie Clearance** — Both the `jwt-token` and `refresh-token` cookies are cleared by setting `maxAge=0`.
4. **Confirmation** — A success message is returned.

#### 1.5 Current User Profile (`GET /api/v1/auth/me`)
This endpoint returns the profile of the currently authenticated user:
1. **Authentication Resolution** — The `Authentication` object from Spring Security's security context is extracted.
2. **User Lookup** — The username from the authentication object is used to fetch the full user record.
3. **Response** — An `AuthResponse` containing id, username, role, email, organizationId, photo, and fullName is returned.

### Authentication Flow Diagram

```
┌──────────┐     ┌──────────────┐     ┌────────────┐     ┌───────────┐
│  Client   │     │ Rate Limiter │     │ JWT Filter │     │ Controller │
│ (Browser) │     │ (Order 1)    │     │ (Order 2)   │     │            │
└─────┬─────┘     └──────┬──────┘     └──────┬──────┘     └─────┬─────┘
      │                   │                    │                   │
      │  1. POST /login   │                    │                   │
      │──────────────────>│                    │                   │
      │                   │  2. Check rate     │                   │
      │                   │  limit (10/60s)    │                   │
      │                   │───────────────────>│                   │
      │                   │                    │  3. No JWT cookie │
      │                   │                    │  (anonymous)      │
      │                   │                    │──────────────────>│
      │                   │                    │                   │
      │                   │                    │  4. Validate      │
      │                   │                    │  credentials      │
      │                   │                    │  Check lockout    │
      │                   │                    │  Check active     │
      │                   │                    │  Authenticate     │
      │                   │                    │                   │
      │  5. Set cookies   │                    │                   │
      │  + AuthResponse   │                    │                   │
      │<───────────────────────────────────────────────────────────│
```

### Security Mechanisms

| Mechanism | Implementation | Protection Against |
|---|---|---|
| **HttpOnly Cookies** | `jwt-token` and `refresh-token` cookies with `HttpOnly=true` | XSS (cross-site scripting) — JavaScript cannot read the tokens |
| **SameSite=Strict / Secure** | All cookies marked with `SameSite=Strict` and `Secure=true` | CSRF (cross-site request forgery) — cookies not sent on cross-site requests; Secure prevents HTTP leakage |
| **Short-lived JWT** | 15-minute expiry | Token leakage — stolen tokens are valid only briefly |
| **Refresh Token Rotation** | Old token revoked, new token issued on each refresh | Replay attacks — a stolen refresh token can be used only once |
| **Account Lockout** | 5 failed attempts → 15-minute lockout | Brute force password guessing |
| **Rate Limiting** | 10 requests per 60 seconds per IP on auth endpoints | Brute force and DDoS on login |
| **BCrypt Hashing** | 10 rounds of BCrypt | Password cracking if database is compromised |
| **No ADMIN Self-Registration** | Signup explicitly blocks ADMIN role; admin user (username "admin") and ADMIN/MCIT Clients roles protected from deletion/role-change | Privilege escalation via registration |
| **Generic Error Messages** | "Invalid username or password" (doesn't reveal which is wrong) | Username enumeration |

### Data Flow

```
Request Body (JSON):                     Response Body (JSON):
{                                        {
  "username": "admin",                     "id": 1,
  "password": "admin123"                   "username": "admin",
}                                          "role": "ADMIN",
                                           "email": "admin@system.com",
Response Cookies:                          "organizationId": null,
  jwt-token=eyJ...; HttpOnly;              "photo": null,
    Path=/; Max-Age=900; SameSite=Lax      "fullName": "System Admin"
  refresh-token=dGhpcyBpcyBh...;         }
    HttpOnly; Path=/api/v1/auth;
    Max-Age=604800; SameSite=Lax
```

---

## 2. User Management Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.UserController` |
| **Base Path** | `/api/v1/users` |
| **Key Files** | `UserController.java`, `UserService.java`, `UserRepository.java`, `User.java` |
| **Frontend** | `CreateUser.tsx` |
| **Database Table** | `users` |

### Overview

The User Management Module handles all user account lifecycle operations. It is used by administrators to create, view, update, and delete user accounts. The module implements **hard delete** — users are permanently removed from the database. The admin user (username "admin") and ADMIN/MCIT Clients roles are protected from deletion or role/active status changes by other users (returns 403 FORBIDDEN).

### Functional Capabilities

#### 2.1 List Users (`GET /api/v1/users`)
Returns a paginated list of all non-deleted users:
1. **Repository Query** — Fetches all users from the database.
2. **Soft Delete Filtering** — Filters out users where `deleted=true`.
3. **In-Memory Pagination** — Performs manual pagination on the filtered list (since the filtering is done in Java, not SQL).
4. **Cache** — Results are cached on the frontend for 5 minutes.

#### 2.2 Get User by ID (`GET /api/v1/users/{id}`)
Returns a single user's details:
1. **Cache Lookup** — Caffeine cache is checked using key `'user:' + id`.
2. **Database Query** — On cache miss, the user is fetched from the database.
3. **Soft Delete Check** — If the user is marked as deleted, a "User not found" error is returned (404).
4. **Response** — Returns `UserResponseDTO` with all user details including role and organization names.

#### 2.3 Create User (`POST /api/v1/users`)
Administrative user creation:
1. **Validation** — Username and email uniqueness are checked.
2. **Password Encoding** — The raw password is BCrypt-encoded before storage.
3. **Active by Default** — Admin-created users are set to `active=true` (unlike self-registration which sets `active=false`).
4. **Audit Logging** — A "CREATE_USER" audit entry is created.
5. **Cache Invalidation** — The users cache is invalidated (both Caffeine and frontend).

#### 2.4 Update User (`PUT /api/v1/users/{id}`)
Partial or full user update:
1. **Existing User Lookup** — The current user record is fetched.
2. **Selective Field Updates** — Only non-null fields in the request are applied:
   - Username: only if changed, with uniqueness check
   - Email: only if provided
   - Full name: only if provided
   - Photo: only if provided
   - Phone: only if provided
   - Role: only if provided
   - Organization: only if provided
   - Active: only if different from current
   - Password: only if non-empty and different from current hash
3. **Password Validation** — If password is being changed, it must be at least 8 characters (re-encoding is avoided if the password hasn't actually changed).
4. **Cache Invalidation** — The users cache is invalidated after successful update.

#### 2.5 Delete User (Hard Delete) (`DELETE /api/v1/users/{id}`)
The hard delete process:
1. **User Lookup** — The user is fetched by ID.
2. **Admin Protection** — If the user's username is "admin", deletion is rejected with a 403 FORBIDDEN and message: "The admin user cannot be deleted".
3. **Ticket Assignment Check** — If the user has any assigned tickets, deletion is rejected with a 409 Conflict status and message: "This user can't be deleted because it's linked to existing tickets."
4. **Hard Delete** — The user is permanently removed from the database. This is a hard delete, not a soft delete — the record is gone.
5. **Related Records** — Related records (tickets, comments, notifications) remain for historical integrity (foreign key constraints allow deletion of the user).

#### 2.6 Change Password (`PUT /api/v1/users/{id}/password`)
Two modes of operation:
1. **Self-Service** (requires `currentPassword`):
   - The current password is verified against the BCrypt hash.
   - If incorrect, an "IllegalArgumentException: Current password is incorrect" is thrown.
   - The new password must be at least 8 characters.
2. **Admin Force-Reset** (`changePasswordWithoutValidation`):
   - No current password verification.
   - Only the new password is required (8+ characters).
   - Used when a user has forgotten their password and the admin is resetting it.

#### 2.7 Upload Profile Picture (`POST /api/v1/users/{id}/profile-picture`)
Two-step upload process:
1. **File Validation** — The uploaded file is checked by `FileValidationService`:
   - Extension must be in allowed image list (jpeg, png, gif)
   - MIME type must match
2. **Storage** — The file is saved via `StorageService` with a UUID-renamed filename.
3. **URL Update** — The user's `photo` field is updated with the file URL.
4. **Cache Invalidation** — The users cache is invalidated.

#### 2.8 Get Users by Service (`GET /api/v1/users/by-service/{serviceName}`)
This endpoint maps service names to support roles:
1. **Role Name Derivation** — The service name is transformed into potential role names:
   - Uppercase with underscores: "EMAIL" → "EMAIL_SUPPORT"
   - Lowercase with underscores: "EMAIL" → "email_support"
   - Direct match against role name and code
2. **Filtering** — All non-deleted users with matching roles are returned.
3. **Use Case** — Used when creating a ticket to show available support staff for the selected service.

### User State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    v                                             │
┌──────────┐   admin    ┌──────────┐   update    ┌────────────┐  │
│  Created  │──────────>│  Active  │────────────>│  Modified  │  │
│ (active=  │  create   │(active=  │             │ (updated   │  │
│  false)   │           │ true)    │             │  fields)   │  │
└──────────┘           └────┬─────┘             └────────────┘  │
      ^                      │                                    │
      │ self-signup          │ admin deactivate                   │
      │                      v                                    │
      │                  ┌──────────┐                             │
      └──────────────────│ Inactive │─────────────────────────────┘
                         │ (active= │   admin reactivate
                         │  false)  │
                         └──────────┘
                              │
                              │ delete
                              v
                         ┌──────────┐
                         │  Deleted │
                         │(deleted= │
                         │ true)     │
                         └──────────┘
```

### Data Relationships

```
User (1) ─────── (M) Ticket (created_by)
User (1) ─────── (M) Ticket (assigned_to)
User (M) ─────── (1) Role
User (M) ─────── (1) Organization
```

---

## 3. Ticket Management Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.TicketController` |
| **Base Path** | `/api/v1/tickets` |
| **Key Files** | `TicketController.java`, `TicketService.java`, `TicketRepository.java`, `Ticket.java`, `Comment.java` |
| **Frontend** | `TicketManagement.tsx`, `MyTickets.tsx`, `MyAssignTicket.tsx` |
| **Database Tables** | `tickets`, `comments`, `notifications`, `audit_logs`, `sla_violations` |

### Overview

The Ticket Management Module is the core business logic of the system. It handles the complete lifecycle of support tickets — creation, assignment, status transitions, commenting, and attachment management. The module integrates with the Notification Module for real-time updates and the SLA Tracking Module for service level compliance monitoring.

### Functional Capabilities

#### 3.1 Ticket States and Transitions

```
┌──────────┐    assign    ┌──────────────┐    resolve    ┌──────────┐
│ PENDING  │────────────>│ IN_PROGRESS  │──────────────>│  SOLVED  │
│          │              │              │               │          │
│ No       │              │ Assigned to  │               │ Resolved │
│ assignee │<─────────────│ support staff│               │ ticket   │
└──────────┘   unassign   └──────────────┘               └──────────┘
```

#### 3.2 Create Ticket (`POST /api/v1/tickets`)
The ticket creation process:
1. **Data Assembly** — The ticket is constructed from the request data (subject, description, service, organization).
2. **Creator Assignment** — The currently authenticated user is set as the `createdBy` field.
3. **Initial State** — The status is set to `PENDING` and no assignee is set.
4. **Attachment Handling** — If a file is included as `multipart/form-data`:
   - The file is validated by `FileValidationService` (extension + MIME type)
   - The file is renamed using `UUID_originalname.ext` format
   - The file is stored via `StorageService`
   - The `attachmentPath` field is set to the stored path
5. **Persistence** — The ticket and any attachment are saved.
6. **Notification** — All ADMIN users are notified via WebSocket about the new ticket.
7. **SLA Check** — The SLA response time is evaluated (if the service has an SLA configuration).
8. **Audit Logging** — A "CREATE_TICKET" entry is logged.

#### 3.3 Assign Ticket (`POST /api/v1/tickets/{ticketId}/assign/{userId}`)
1. **State Change** — The ticket status is changed to `IN_PROGRESS`.
2. **Assignee Setting** — The `assignedTo` field is set to the specified user.
3. **Notification** — The assigned user receives a real-time notification.
4. **SLA Check** — The response time is evaluated (time from creation to assignment vs. threshold).
5. **Audit Logging** — An "ASSIGN_TICKET" entry is logged.

#### 3.4 Unassign Ticket (`DELETE /api/v1/tickets/{ticketId}/assign`)
1. **State Change** — The ticket status reverts to `PENDING`.
2. **Assignee Clearing** — The `assignedTo` field is set to `null`.
3. **Audit Logging** — An "UNASSIGN_TICKET" entry is logged.

#### 3.5 Update Status (`PATCH /api/v1/tickets/{id}/status`)
1. **Status Change** — The ticket status is updated to the specified value.
2. **Solved Timestamp** — If the new status is `SOLVED`, the `solvedAt` field is set to the current timestamp.
3. **Notification** — The ticket creator and all organization users are notified.
4. **SLA Check** — If resolved, the resolve time is evaluated (time from creation to solved vs. threshold).
5. **Audit Logging** — A "STATUS_CHANGE" entry is logged.

#### 3.6 Add Comment (`POST /api/v1/tickets/{ticketId}/comments`)
1. **Comment Creation** — A new `Comment` entity is created with the message text and the authenticated user.
2. **Association** — The comment is added to the ticket's comment collection.
3. **Notification** — The ticket creator and current assignee receive notifications.
4. **Audit Logging** — A "ADD_COMMENT" entry is logged.

#### 3.7 Get Tickets with Filtering
The module provides multiple filtered listing endpoints:

| Endpoint | Filter Criteria | Use Case |
|---|---|---|
| `GET /api/v1/tickets` | All tickets (paginated) | Admin ticket management |
| `GET /api/v1/tickets/organization/{orgId}` | By organization | Organization dashboard |
| `GET /api/v1/tickets/assigned/{userId}` | By assignee | My assigned tickets |
| `GET /api/v1/tickets/unassigned` | No assignee | Unassigned queue |
| `GET /api/v1/tickets/recent` | Recent first | Dashboard widget |

Each endpoint returns paginated results with `Pageable` support for `page`, `size`, and `sort` parameters.

#### 3.8 Update Ticket (`PUT /api/v1/tickets/{id}`)
Supports two content types:
1. **JSON Body** — Updates ticket fields without modifying attachments.
2. **Multipart/Form-Data** — Updates ticket fields and replaces the attachment.

If the attachment is being replaced, the old file is deleted from storage before the new one is saved.

#### 3.9 Delete Ticket (`DELETE /api/v1/tickets/{id}`)
1. **Notification Cleanup** — All notifications related to the ticket are deleted.
2. **File Cleanup** — The associated attachment file is deleted from storage.
3. **Ticket Deletion** — The ticket record is deleted from the database (hard delete, not soft delete).

### SLA Integration

The Ticket Management module integrates with the SLA Tracking module at two trigger points:

1. **Response Time** — Triggered when a ticket transitions from PENDING to IN_PROGRESS (assignment). If the time between creation and assignment exceeds the service's configured `responseTimeMinutes`, a `SlaViolation` of type `RESPONSE_TIME` is created.

2. **Resolve Time** — Triggered when a ticket transitions to SOLVED. If the time between creation and resolution exceeds the service's configured `resolveTimeMinutes`, a `SlaViolation` of type `RESOLVE_TIME` is created.

### Performance Optimizations

| Optimization | Implementation | Benefit |
|---|---|---|
| **Paginated Queries** | Spring Data `Pageable` on all list endpoints | Server-side pagination prevents loading all records |
| **Database Indexes** | V6 migration adds indexes on `status`, `assigned_to_id`, `organization_id`, `created_by_id`, `created_at` | Filter and sort operations use index scans instead of sequential scans |
| **Comment Count Formula** | `@Formula` annotation with subquery | Avoids storing and maintaining a separate counter column |
| **Cached Dashboard** | Dashboard summary is a single aggregated query | Reduces 14+ individual queries to 1 |

### Data Model

```
Ticket
├── id: Long (PK)
├── subject: String
├── description: String (TEXT)
├── status: Enum (PENDING, IN_PROGRESS, SOLVED)
├── service: ManyToOne → Service
├── organization: ManyToOne → Organization
├── createdBy: ManyToOne → User
├── assignedTo: ManyToOne → User (nullable)
├── attachmentPath: String (nullable)
├── commentCount: Integer (@Formula)
├── assignedAt: LocalDateTime (nullable, set on assignment)
├── createdAt: LocalDateTime
├── updatedAt: LocalDateTime
├── solvedAt: LocalDateTime (nullable)
└── comments: OneToMany → Comment
```

---

## 4. Service Management Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.ServiceController` |
| **Base Path** | `/api/v1/services` |
| **Key Files** | `ServiceController.java`, `ServiceService.java`, `ServiceRepository.java`, `Service.java` |
| **Frontend** | `ServiceManagement.tsx` |
| **Database Table** | `services` |

### Overview

The Service Management Module manages service categories — the types of IT services that tickets can be created against. Examples include Email Support, Domain Support, VM Support, and Server Support. Each service can have an associated SLA configuration (response and resolve time thresholds). Services are also used to determine which support staff are available for assignment.

### Functional Capabilities

#### 4.1 List Services (`GET /api/v1/services`)
Returns a paginated list of all services. This is a public endpoint (no authentication required) used by the ticket creation form and various dropdown selectors across the application.

#### 4.2 Get Service by ID (`GET /api/v1/services/{id}`)
Returns a single service by its ID. The result is cached in Caffeine with a 1-hour TTL.

#### 4.3 Create Service (`POST /api/v1/services`)
Administrative creation of a new service category:
1. **Validation** — The service name must be unique.
2. **Persistence** — The service is saved with an auto-generated timestamp.
3. **Cache Invalidation** — The services cache is invalidated (both Caffeine and frontend).

#### 4.4 Update Service (`PUT /api/v1/services/{id}`)
1. **Existence Check** — If the service is not found, a `ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found")` is thrown (returns 404, not 500).
2. **Field Update** — The service name and description are updated.
3. **Cache Invalidation** — The services cache is invalidated after the update.

#### 4.5 Delete Service (`DELETE /api/v1/services/{id}`)
1. **Constraint Check** — If any tickets reference this service, deletion is rejected with a 409 Conflict.
2. **Deletion** — The service is removed from the database.
3. **Cache Invalidation** — The services cache is invalidated after deletion.

### Role-Service Mapping

Services and support roles are related by naming convention:

```
Service Name → Expected Support Role Name
──────────────────────────────────────────
"Domain"    → "Domain Support Staff" or "DOMAIN_SUPPORT"
"Email"     → "Email Support Staff" or "EMAIL_SUPPORT"
"VM"        → "VM Support Staff" or "VM_SUPPORT"
"Server"    → "Server Support Staff" or "SERVER_SUPPORT"
```

When the system needs to find support staff for a service, it applies multiple naming conventions to match:
- Uppercase with underscores: `EMAIL_SUPPORT`
- Original case with underscores: `Email_Support`
- Lowercase with underscores: `email_support`
- Direct name match: `Email Support Staff`

This flexible matching accommodates variations in role naming conventions.

---

## 5. Organization Management Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.OrganizationController` |
| **Base Path** | `/api/v1/organizations` |
| **Key Files** | `OrganizationController.java`, `OrganizationService.java`, `OrganizationRepository.java`, `Organization.java` |
| **Frontend** | `OrganizationManagement.tsx` |
| **Database Table** | `organizations` |

### Overview

The Organization Management Module manages client organizations — the companies or departments that use the ticket system. Each user belongs to an organization, and tickets are typically scoped by organization. The module provides organization-level statistics and ensures data isolation between organizations.

### Functional Capabilities

#### 5.1 CRUD Operations
Standard create, read, update, delete operations for organizations:
- **Create** — Requires name, optional email, phone, address.
- **Read** — Public GET access for dropdowns; cached with 30-minute TTL on the backend.
- **Update** — Partial field updates.
- **Delete** — Protected by constraint checks: cannot delete if any users or tickets reference the organization.

#### 5.2 Organization Statistics (`GET /api/v1/organizations/{id}/stats`)
Returns aggregated data for an organization:
1. **Ticket Count** — Total number of tickets for the organization.
2. **Service Distribution** — Count of distinct services used.
3. **User Count** — Number of users belonging to the organization.

### Data Isolation

Organizations provide natural data isolation:
- **Ticket Scoping** — Organization users see only their organization's tickets.
- **User Scoping** — Organization-level views show only users within the same organization.
- **Admin Override** — System administrators can view data across all organizations.

---

## 6. Role Management Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.RoleController` |
| **Base Path** | `/api/v1/roles` |
| **Key Files** | `RoleController.java`, `RoleService.java`, `RoleRepository.java`, `Role.java` |
| **Frontend** | `CreateRole.tsx` |
| **Database Table** | `roles` |

### Overview

The Role Management Module manages user roles, which define the permissions and access levels within the system. Roles determine what actions a user can perform and what data they can see. The module provides a flexible role definition system with auto-generated role codes that integrate with Spring Security's authorization framework.

### Built-in Roles

| Role Name | Code | Spring Security Authority | Access Scope |
|---|---|---|---|
| System Administrator | ADMIN | ROLE_ADMIN | Full system access, all CRUD operations |
| MCIT Clients | MCIT_CLIENTS | ROLE_MCIT_CLIENTS | Client organization ticket submission |
| Client Organization | ORGANIZATION | ROLE_ORGANIZATION | Create and view own tickets |
| Domain Support Staff | DOMAIN_SUPPORT | ROLE_DOMAIN_SUPPORT | Manage domain-related tickets |
| Email Support Staff | EMAIL_SUPPORT | ROLE_EMAIL_SUPPORT | Manage email-related tickets |
| VM Support Staff | VM_SUPPORT | ROLE_VM_SUPPORT | Manage VM-related tickets |
| Server Support Staff | SERVER_SUPPORT | ROLE_SERVER_SUPPORT | Manage server-related tickets |
| Support user role | SUPPORT | ROLE_SUPPORT | General support operations |

### Functional Capabilities

#### 6.1 Role Code Auto-Generation
When a role is created, a machine-readable `code` is automatically generated from the human-readable `name`:
- "System Administrator" → "ADMIN"
- "Email Support Staff" → "EMAIL_SUPPORT"
- "Client Organization" → "ORGANIZATION"

This code is used for:
1. Spring Security authorization (`hasRole("ADMIN")`)
2. Service-to-role mapping for finding support staff
3. Frontend role display

#### 6.2 Authorization Enforcement

The `SecurityConfig` class uses the role codes for authorization:

```java
.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
.requestMatchers(HttpMethod.POST, "/api/v1/services/**").hasRole("ADMIN")
.requestMatchers("/api/v1/users/**").authenticated()
```

Spring Security automatically prefixes the role code with `ROLE_` when matching against `CustomUserDetailsService.getAuthorities()`.

### Role Assignment Rules

| Source | Can Assign Role |
|---|---|
| Self-Registration | Any role EXCEPT ADMIN |
| Admin User Creation | Any role |
| Admin User Update | Any role |

---

## 7. Notification Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.NotificationController` |
| **Base Path** | `/api/v1/notifications` |
| **Key Files** | `NotificationController.java`, `NotificationService.java`, `WebSocketNotificationSender.java`, `Notification.java` |
| **Frontend** | `NotificationDisplay.tsx`, `NotificationContext.tsx`, `useWebSocket.ts` |
| **Database Table** | `notifications` |

### Overview

The Notification Module provides real-time and persistent notification delivery. When events occur in the system (new tickets, assignments, comments, status changes), affected users are notified immediately via WebSocket push. Notifications are also stored in the database so they persist across sessions and can be reviewed later.

### Notification Types

| Type | Trigger | Recipients |
|---|---|---|
| NEW_TICKET | A new ticket is created | All ADMIN users |
| ASSIGNMENT | A ticket is assigned to a user | The assigned user |
| STATUS_CHANGE | A ticket's status changes | Ticket creator + organization users |
| NEW_COMMENT | A comment is added to a ticket | Ticket creator + current assignee |

### Functional Capabilities

#### 7.1 Notification Creation
When an event occurs, `NotificationService` is called:
1. **Record Creation** — A new `Notification` entity is created with:
   - `user` — The recipient user
   - `ticket` — The related ticket
   - `type` — One of the four notification types
   - `message` — A human-readable description
   - `isRead` — Initially `false`
2. **Database Persistence** — The notification is saved to the database.
3. **WebSocket Push** — `WebSocketNotificationSender.sendToUser()` is called, pushing the notification to the user's WebSocket topic.

#### 7.2 WebSocket Delivery

**Backend (STOMP Broker):**
```
Endpoint: /ws (SockJS)
Broker: /topic
User Topic: /topic/notifications/{userId}
Payload: { "id": 1, "type": "NEW_TICKET", "message": "...", "ticketId": 5, ... }
```

**Frontend (STOMP Client):**
```
Connection: SockJS → /ws
Subscription: /topic/notifications/{userId}
Handler: Dispatch to NotificationContext
  → Update unread count badge
  → Show toast notification
  → Add to notification list
```

#### 7.3 Read Status Management

| Operation | Endpoint | Effect |
|---|---|---|
| Mark as read | `PATCH /notifications/{id}/read` | Sets `isRead=true`, `readAt=now` |
| Mark all read | `PATCH /notifications/user/{userId}/read-all` | Updates all unread notifications for the user |
| Get unread count | `GET /notifications/count/{userId}` | Returns count of `isRead=false` records |

#### 7.4 Notification Listing

| Endpoint | Description |
|---|---|
| `GET /notifications/user/{userId}` | Paginated list of all notifications |
| `GET /notifications/unread/{userId}` | Paginated list of unread notifications |

Both endpoints return `NotificationResponseDTO` with id, type, message, isRead, createdAt, and ticketId.

---

## 8. Audit Logging Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.service.AuditLogService` |
| **Key Files** | `AuditLogService.java`, `AuditLogRepository.java`, `AuditLog.java` |
| **Database Table** | `audit_logs` |

### Overview

The Audit Logging Module creates an immutable record of significant events in the system. Every important action — logins, ticket operations, user management — is recorded with a timestamp, the acting user, a description, and optionally the before/after state of the affected entity. This provides a complete audit trail for security review, compliance, and debugging.

### Audit Log Schema

```
audit_logs
├── id: Long (PK)
├── entity_type: String       -- "AUTH", "USER", "TICKET", "SERVICE", "ROLE", "ORGANIZATION"
├── entity_id: Long           -- ID of the affected entity
├── action: String            -- "LOGIN_SUCCESS", "CREATE_TICKET", "ASSIGN_TICKET", etc.
├── performed_by_id: Long     -- User who performed the action
├── performed_by_username: String  -- Username snapshot (persists if user deleted)
├── details: String (TEXT)    -- Human-readable description
├── old_value: String (TEXT)  -- JSON snapshot before change
├── new_value: String (TEXT)  -- JSON snapshot after change
├── timestamp: LocalDateTime  -- When the action occurred
```

### Audit Events

| Entity Type | Actions Logged |
|---|---|
| AUTH | LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, SIGNUP |
| USER | CREATE_USER, UPDATE_USER, DELETE_USER, PASSWORD_CHANGE, FORCE_PASSWORD_CHANGE, PROFILE_PICTURE_CHANGE |
| TICKET | CREATE_TICKET, UPDATE_TICKET, DELETE_TICKET, ASSIGN_TICKET, UNASSIGN_TICKET, STATUS_CHANGE, ADD_COMMENT |
| SERVICE | CREATE_SERVICE, UPDATE_SERVICE, DELETE_SERVICE |
| ROLE | CREATE_ROLE, UPDATE_ROLE, DELETE_ROLE |
| ORGANIZATION | CREATE_ORG, UPDATE_ORG, DELETE_ORG |

### Logging Pattern

```java
// Called from service/controller layers after successful operation
auditLogService.log(
    "TICKET",           // entityType
    ticket.getId(),     // entityId
    "ASSIGN_TICKET",    // action
    userId,             // performedById
    username,           // performedByUsername
    "Ticket " + id + " assigned to " + assigneeName,  // details
    null,               // oldValue (optional)
    assigneeName        // newValue (optional)
);
```

---

## 9. File Upload Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.service.FileValidationService` |
| **Key Files** | `FileValidationService.java`, `StorageService.java`, `LocalStorageService.java`, `S3StorageService.java` |
| **Frontend** | `fileUtils.ts` |

### Overview

The File Upload Module handles all file upload operations — ticket attachments and user profile photos. It provides server-side validation, secure filename generation, and a pluggable storage backend that supports both local filesystem and AWS S3 cloud storage.

### File Validation Process

```
Upload Request
      │
      v
┌─────────────────────────┐
│ 1. Extract File Extension │
└──────────┬──────────────┘
           │
           v
┌─────────────────────────┐
│ 2. Check Extension       │
│    Whitelist             │
│    (pdf, doc, docx,      │
│     xls, xlsx, png,      │
│     jpg, jpeg, gif,      │
│     txt, zip, rar)       │
└──────────┬──────────────┘
           │
           v
┌─────────────────────────┐
│ 3. Read MIME Type        │
└──────────┬──────────────┘
           │
           v
┌─────────────────────────┐
│ 4. Validate MIME against │
│    Allowed Types         │
└──────────┬──────────────┘
           │
           v
┌─────────────────────────────┐
│ 5. Magic Bytes Validation   │
│    Check file header bytes  │
│    against known signatures │
│    JPEG: FF D8 FF           │
│    PNG: 89 50 4E 47        │
│    PDF: 25 50 44 46        │
│    ZIP: 50 4B 03 04        │
│    RAR: 52 61 72 21        │
│    OLE2: D0 CF 11 E0      │
└──────────┬──────────────┘
           │
           v
┌─────────────────────────┐
│ 6. Generate UUID Filename│
│    {UUID}_{original.ext} │
└──────────┬──────────────┘
           │
           v
┌─────────────────────────┐
│ 7. Store via StorageService│
│    (path traversal checked │
│     via resolveSafePath())│
└─────────────────────────┘
```

### Storage Service Interface

```java
public interface StorageService {
    String store(MultipartFile file, String filename);
    void delete(String filepath);
    String getUrl(String filepath);
}
```

#### LocalStorageService
- **Storage Path**: `uploads/{UUID_originalname.ext}`
- **Serving**: Spring resource handler at `/uploads/**`
- **Download URL**: `http://localhost:8080/uploads/{filename}`

#### S3StorageService
- **Storage**: AWS S3 bucket (configured via `AWS_S3_BUCKET` env var)
- **Credentials**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Configuration**: Activated by setting `app.storage.type=s3`

### Frontend Integration

The `fileUtils.ts` utility provides display filename extraction:
- **Stored format**: `{UUID}_{originalname.ext}`
- **Display format**: `originalname.ext` (UUID prefix stripped)
- **Download format**: Original filename preserved for user download

### Image Validation (Profile Photos)

For profile pictures, additional validation is applied:
- **Image types only**: jpeg, png, gif
- **Validation enforced on both frontend** (before upload) and **backend** (after upload)

---

## 10. SLA Tracking Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.service.SlaService` |
| **Key Files** | `SlaService.java`, `SlaConfig.java`, `SlaViolation.java`, `SlaConfigRepository.java`, `SlaViolationRepository.java` |
| **Database Tables** | `sla_configs`, `sla_violations` |

### Overview

The SLA Tracking Module monitors service level compliance. Each service can have configured thresholds for response time (how quickly a ticket should be assigned) and resolve time (how quickly a ticket should be solved). When these thresholds are exceeded, a violation record is created for reporting and analysis.

### SLA Configuration

```
SlaConfig
├── id: Long (PK)
├── service: OneToOne → Service
├── responseTimeMinutes: Integer  -- Max time to first response/assignment
├── resolveTimeMinutes: Integer   -- Max time to resolution
├── createdAt: LocalDateTime
└── updatedAt: LocalDateTime
```

A service without an SLA configuration has no thresholds — violations are not tracked for it.

### Violation Detection Algorithm

```
checkResponseTime(Ticket ticket):
  1. Load SlaConfig for ticket's service
  2. If no config exists → return (no SLA configured)
  3. If ticket has no assignedTo → return (not yet assigned)
  4. responseTime = now - ticket.createdAt (in minutes)
  5. If responseTime > config.responseTimeMinutes:
     → Create SlaViolation(RESPONSE_TIME)
     → Record expected vs actual minutes

checkResolveTime(Ticket ticket):
  1. Load SlaConfig for ticket's service
  2. If no config exists → return
  3. If ticket.status ≠ SOLVED → return
  4. resolveTime = ticket.solvedAt - ticket.createdAt (in minutes)
  5. If resolveTime > config.resolveTimeMinutes:
     → Create SlaViolation(RESOLVE_TIME)
     → Record expected vs actual minutes
```

### Violation Record

```
SlaViolation
├── id: Long (PK)
├── ticket: ManyToOne → Ticket
├── violationType: Enum (RESPONSE_TIME, RESOLVE_TIME)
├── expectedMinutes: Integer     -- Configured threshold
├── actualMinutes: Integer       -- Actual elapsed time
├── breachedAt: LocalDateTime    -- When breach was detected
├── escalated: Boolean           -- For future auto-escalation
└── escalatedAt: LocalDateTime
```

### Trigger Points

| Event | SLA Check |
|---|---|
| Ticket assigned (PENDING → IN_PROGRESS) | `checkResponseTime()` |
| Ticket resolved (→ SOLVED) | `checkResolveTime()` |

---

## 11. Dashboard Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.controller.DashboardController` |
| **Base Path** | `/api/v1/admin/dashboard-summary` |
| **Key Files** | `DashboardController.java`, `DashboardSummaryDTO.java` |
| **Frontend** | `AdminDashboard.tsx` |

### Overview

The Dashboard Module provides an aggregated view of system activity and health. It was created as a performance optimization — replacing 14+ individual API calls with a single, pre-aggregated endpoint. The data is cached for 2 minutes both on the backend and via HTTP cache headers.

### Dashboard Summary DTO

```
DashboardSummaryDTO
├── totalUsers: Long
├── totalOrganizations: Long
├── totalServices: Long
├── stats: Map<String, Long>        -- { "pending": 12, "inProgress": 8, "solved": 45 }
├── unassignedTickets: List<TicketDTO>  -- Tickets with no assignee
├── recentTickets: List<TicketDTO>      -- 5 most recent tickets
└── serviceDistribution: List<Map>      -- Tickets grouped by service name
```

### Performance Comparison

| Metric | Before (14 calls) | After (1 call) |
|---|---|---|
| HTTP Roundtrips | 14 | 1 |
| Server-Side Queries | ~30 (N+1 issues) | ~8 (optimized) |
| Page Load Time | ~2-3 seconds | ~300ms |
| Cache Hit Ratio | 0% (no caching) | 100% (2-min TTL) |

### Cache Strategy

| Cache Layer | Key | TTL | Invalidation |
|---|---|---|---|
| HTTP (`Cache-Control`) | URL path | 120 seconds | Time-based (no active invalidation) |
| Caffeine (via service) | 'dashboard' | 120 seconds | Time-based (no active invalidation) |
| Frontend (apiCache) | 'dashboard-summary' | 120 seconds | Time-based |

Dashboard data is considered "time-tolerant" — a 2-minute delay in seeing updated statistics is acceptable for an overview page.

---

## 12. Password Reset Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.service.PasswordResetService` |
| **Key Files** | `PasswordResetService.java`, `PasswordResetToken.java`, `PasswordResetTokenRepository.java` |
| **Frontend** | `ForgotPassword.tsx` |
| **Database Table** | `password_reset_tokens` |

### Overview

The Password Reset Module provides a secure, three-step password reset flow: request an OTP via email, verify the OTP, and reset the password. The module implements multiple security layers to prevent abuse: rate limiting, OTP expiry, attempt tracking, and generic response messages that prevent email enumeration.

### Three-Step Flow

```
Step 1: Forgot Password
────────────────────────
User enters email
  → System generates 6-digit OTP
  → Stores OTP with 5-minute expiry
  → Sends email (async)
  → Returns: "If the email exists, an OTP has been sent."

Step 2: Verify OTP
──────────────────
User enters email + OTP
  → Lookup token by email + OTP
  → Validate: not expired, not used, failedAttempts < 3
  → Mark as used
  → Returns: "OTP verified successfully"

Step 3: Reset Password
──────────────────────
User enters email + OTP + new password
  → Same verification as Step 2
  → BCrypt-encode new password
  → Update user record
  → Revoke all refresh tokens (force re-login)
  → Delete password reset token
  → Returns: "Password reset successfully"
```

### Password Reset Token Schema

```
password_reset_tokens
├── id: Long (PK)
├── email: String (unique index)
├── otp: String (6 digits)
├── expiry_date: LocalDateTime  -- 5 minutes from creation
├── used: Boolean
├── failed_attempts: Integer    -- Reset to 0 on new OTP
└── created_at: LocalDateTime
```

### Security Mechanisms

| Mechanism | Implementation |
|---|---|
| **OTP Expiry** | 5 minutes from creation, stored as `expiryDate` |
| **Attempt Limiting** | 3 wrong OTP attempts → token invalidated (locked) |
| **Rate Limiting** | Max 1 OTP per minute per email (in-memory rate tracker) |
| **Generic Response** | Same response whether email exists or not — prevents email enumeration |
| **BCrypt Encoding** | New password is BCrypt-encoded before storage |
| **Session Invalidation** | All refresh tokens revoked after password reset |

---

## 13. Caching Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.config.CacheConfig` |
| **Key Files** | `CacheConfig.java`, `apiCache.ts` |
| **Frontend** | `utils/apiCache.ts`, `services/api.ts` |

### Overview

The Caching Module implements a two-layer caching strategy. The backend layer uses Caffeine (in-memory, zero external dependencies) to cache database query results at the service level. The frontend layer uses an in-memory TTL cache to reduce redundant HTTP requests and provide in-flight request deduplication.

### Backend Caching (Caffeine)

```
Cache Manager Configuration
├── Provider: CaffeineCacheManager
├── Caches: roles, services, organizations, users
├── Max Size: 1000 entries per cache
├── TTLs:
│   ├── roles: 1 hour
│   ├── services: 1 hour
│   ├── organizations: 30 minutes
│   └── users: 5 minutes
├── Stats Recording: enabled (Micrometer integration)
└── Error Handler: LoggingCacheErrorHandler (logs warnings, never throws)
```

**Usage Pattern:**
```java
@Service
public class UserService {
    
    @Cacheable(value = "users", key = "'user:' + #id")
    public User getUserById(Long id) {
        // Only called on cache miss
        return userRepository.findById(id).orElseThrow(...);
    }
    
    @CacheEvict(value = "users", allEntries = true)
    public User createUser(User user) {
        return userRepository.save(user);
    }
}
```

### Frontend Caching (In-Memory)

```
ApiCache Class
├── Data Structure: Map<string, CacheEntry<T>>
├── Key Expiry: TTL-based (Date.now() comparison)
├── In-Flight Dedup: Map<string, Promise<T>>
│   └── Concurrent calls for same key share one promise
├── Cache TTLs:
│   ├── users: 5 minutes
│   ├── roles: 15 minutes
│   ├── services: 15 minutes
│   ├── organizations: 15 minutes
│   └── dashboard: 2 minutes
└── Invalidation Strategies:
    ├── After create/update/delete operations
    ├── On tab visibility change (focus)
    └── After user signup
```

**Usage Pattern:**
```typescript
export const userAPI = {
  getAll: () =>
    apiCache.fetch<AxiosResponse>(
      'users',
      () => api.get('/users'),
      CACHE_TTL.USERS  // 5 minutes
    ),
  update: async (id: number, data: UserData) => {
    const response = await api.put(`/users/${id}`, data);
    apiCache.invalidate('users');  // Clear after write completes
    return response;
  },
};
```

### Cache Invalidation Timing

Critical design decision: cache invalidation happens **after** the write operation, not before.

```
Before (race condition window):
  invalidate('users') → cache cleared
  api.put('/users/1', data) → starts write
  [if any code calls loadUsers() here, it gets OLD data from DB and re-caches it]
  write completes → DB updated
  loadUsers() → cache HIT with OLD data → stale display
  
After (correct):
  api.put('/users/1', data) → write completes
  invalidate('users') → cache cleared
  loadUsers() → cache MISS → fetches NEW data from DB → correct display
```

---

## 14. Rate Limiting Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.security.RateLimitingFilter` |
| **Key Files** | `RateLimitingFilter.java`, `RedisRateLimiter.java` |
| **Order in Filter Chain** | 1 (after CorrelationIdFilter, before JwtAuthenticationFilter) |

### Overview

The Rate Limiting Module protects authentication endpoints from brute-force attacks and accidental overuse. It implements a sliding window algorithm using Redis Lua scripts for atomic, performant rate checking. The module is designed with a **fail-open** approach — if Redis is unavailable, requests are allowed through rather than blocking all traffic. Client IP is determined from the `X-Real-IP` header first, falling back to `getRemoteAddr()`.

### Sliding Window Algorithm

```
Request arrives at /api/v1/auth/login
         │
         v
   ┌─────────────────────┐
   │ Build rate key:      │
   │ "rate_limit:{clientIP}"│
   └──────────┬──────────┘
              │
              v
   ┌─────────────────────┐
   │ Execute Lua Script:  │
   │                      │
   │ 1. Remove entries    │
   │    older than 60s    │
   │                      │
   │ 2. Count entries     │
   │    in current window │
   │                      │
   │ 3. If count >= 10:   │
   │    return 0 (reject) │
   │                      │
   │ 4. Else: add entry   │
   │    return 1 (allow)  │
   └──────────┬──────────┘
              │
              v
   ┌─────────────────────┐
   │ If reject (0):       │
   │ → Return 429         │
   │ → Retry-After header │
   │                      │
   │ If allow (1):        │
   │ → Continue filter    │
   │   chain              │
   └─────────────────────┘
```

### Configuration

| Parameter | Value | Target |
|---|---|---|
| Window Duration | 60 seconds | All `/api/v1/auth/*` endpoints |
| Max Requests | 10 per window per IP | Login, signup, forgot-password, etc. |
| Failure Mode | Fail open (allow through) | Redis connection failure |

### Redis Lua Script

```lua
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local identifier = ARGV[4]  -- unique request identifier

redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)
local count = redis.call('ZCARD', key)

if count >= maxRequests then
    return 0
end

redis.call('ZADD', key, now, identifier)
redis.call('EXPIRE', key, window)
return 1
```

### Fail-Open Behavior

```java
try {
    boolean allowed = redisRateLimiter.tryAcquire(key, 10, 60);
    if (!allowed) {
        response.setStatus(429);
        response.getWriter().write("{\"error\":\"Too many requests\"}");
        return;
    }
} catch (Exception e) {
    // Redis is down — allow request through (fail-open)
    log.error("Rate limiting unavailable, allowing request. Redis error: {}", e.getMessage());
}
```

---

## 15. WebSocket Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.config.WebSocketConfig` |
| **Key Files** | `WebSocketConfig.java`, `WebSocketNotificationSender.java` |
| **Frontend** | `useWebSocket.ts`, `NotificationContext.tsx` |
| **Protocol** | STOMP over WebSocket |

### Overview

The WebSocket Module provides real-time, bidirectional communication between the server and clients. It is used exclusively for push notifications — when a ticket event occurs, affected users receive the notification instantly without polling. The module uses STOMP (Simple Text Oriented Messaging Protocol) over WebSocket with SockJS as a fallback for environments where WebSocket is not supported. Connections are authenticated via JWT Bearer token checked by `WebSocketAuthInterceptor` on CONNECT, and origins are restricted to `http://localhost:*` and `https://*.mcitservices.af`.

### Architecture

```
┌─────────────────┐        WebSocket         ┌─────────────────┐
│  Backend Server │◄────────────────────────►│  Browser Client │
│                 │        /ws + SockJS       │                 │
│  STOMP Broker   │◄──── topic: /topic ─────►│  STOMP Client   │
│  /topic         │                           │  (stompjs)      │
│                 │    /topic/notifications/  │                 │
│  Notification   │    {userId}               │  Notification   │
│  Service        │──────────────────────────►│  Context        │
└─────────────────┘                           └─────────────────┘
```

### Backend Configuration

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    
    public WebSocketConfig(WebSocketAuthInterceptor webSocketAuthInterceptor) {
        this.webSocketAuthInterceptor = webSocketAuthInterceptor;
    }
    
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:*", "https://*.mcitservices.af")
                .withSockJS();
    }
    
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthInterceptor);
    }
}
```

### Push Mechanism

```java
@Service
public class WebSocketNotificationSender {
    
    private final SimpMessagingTemplate messagingTemplate;
    
    public void sendToUser(Long userId, Map<String, Object> payload) {
        messagingTemplate.convertAndSendToUser(
            userId.toString(),
            "/topic/notifications",
            payload
        );
    }
    
    public void sendUnreadCount(Long userId, long count) {
        messagingTemplate.convertAndSendToUser(
            userId.toString(),
            "/topic/notifications/count",
            Map.of("unreadCount", count)
        );
    }
}
```

### Frontend Integration

```typescript
// useWebSocket.ts (simplified)
export function useWebSocket(userId: number | null) {
  useEffect(() => {
    if (!userId) return;
    
    const socket = new SockJS('/ws');
    const client = Stomp.over(socket);
    
    client.connect({}, () => {
      client.subscribe(`/topic/notifications/${userId}`, (message) => {
        const notification = JSON.parse(message.body);
        // Dispatch to NotificationContext
      });
      
      client.subscribe(`/topic/notifications/${userId}/count`, (message) => {
        const { unreadCount } = JSON.parse(message.body);
        // Update badge count
      });
    });
    
    return () => client.disconnect();
  }, [userId]);
}
```

### Reliability Features

| Feature | Implementation |
|---|---|
| **Database Fallback** | Notifications are persisted in the database — if WebSocket is disconnected, user sees them on next page load |
| **SockJS Fallback** | If WebSocket is unavailable (proxy restrictions), SockJS falls back to XHR streaming or long-polling |
| **Auto-Reconnect** | STOMP client automatically attempts reconnection on connection loss |
| **User-Scoped Topics** | Each user subscribes to their own topic — no cross-user notification leakage |

---

## 16. Observability Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.config.CorrelationIdFilter`, `logback-spring.xml` |
| **Key Files** | `CorrelationIdFilter.java`, `logback-spring.xml`, `application-dev.properties`, `application-prod.properties`, `OpenApiConfig.java` |

### Overview

The Observability Module makes the system transparent and debuggable. It encompasses structured logging, correlation IDs for request tracing, metrics collection, API documentation, and error tracking. The module is configured differently per profile — development gets verbose output while production is optimized for log aggregation systems.

### Structured Logging (Production Profile)

```
Log Format: JSON (Logstash Logback Encoder)
─────────────────────────────────────────────

{
  "@timestamp": "2026-06-21T10:30:00.123+04:30",
  "level": "ERROR",
  "logger": "com.ticket.ticket_system.controller.AuthController",
  "thread": "http-nio-8080-exec-4",
  "message": "Login error for user: testuser",
  "mdc": {
    "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "stack_trace": "..."
}
```

**Appenders:**
- **JSON-STDOUT**: Console output (for Docker/container environments where logs go to stdout)
- **FILE**: Rolling JSON file (50MB per file, 14-day history, 500MB total cap)
- **FILE-ERROR**: Separate error-only JSON file (10MB per file, 30-day history)
- **SENTRY**: ERROR-level events to Sentry (when `SENTRY_DSN` environment variable is set)

### Correlation IDs

The `CorrelationIdFilter` adds a unique identifier to every request:

```
Request → CorrelationIdFilter
  ├── Read X-Correlation-Id header from request
  │   └── If absent → Generate UUID
  ├── Store in MDC (Mapped Diagnostic Context)
  │   └── All log entries in this request include the correlation ID
  ├── Set X-Correlation-Id header on response
  │   └── Client can trace specific requests
  └── Continue filter chain
```

### Metrics (Prometheus + Micrometer)

```
Exposed at: /actuator/prometheus (dev profile)

Metric Categories:
├── JVM
│   ├── jvm.memory.used
│   ├── jvm.gc.pause
│   └── jvm.threads.live
├── HTTP
│   ├── http.server.requests (count, duration, status)
│   └── tomcat.sessions.active
├── Cache (Caffeine)
│   ├── cache.gets (hit/miss ratio)
│   ├── cache.evictions
│   └── cache.size
└── Resilience4j
    ├── resilience4j.circuitbreaker.state
    └── resilience4j.retry.calls
```

### API Documentation (Swagger/OpenAPI)

```
URL: http://localhost:8080/swagger-ui.html
Spec: http://localhost:8080/v3/api-docs

Content:
├── 8 Controller Groups (Auth, Tickets, Users, Services, Roles, Organizations, Notifications, Dashboard)
├── All endpoints with @Operation descriptions
├── Request/Response schemas for each endpoint
├── JWT Bearer security scheme
└── Server URL configuration
```

### Profile-Specific Configuration

| Feature | Dev Profile | Prod Profile |
|---|---|---|
| Logging Level | DEBUG | WARN |
| SQL Logging | Verbose (show-sql=true, format=true) | Disabled |
| Actuator Exposure | health, info, readiness, prometheus | health, info |
| Health Details | Always shown | Never shown |
| `app.openapi.server-url` | `http://localhost:8080` | Configured via env var |

---

## 17. Storage Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Package** | `com.ticket.ticket_system.storage` |
| **Key Files** | `StorageService.java`, `LocalStorageService.java`, `S3StorageService.java` |

### Overview

The Storage Module provides an abstraction layer for file storage. It defines a common interface and provides two implementations: local filesystem storage for development and small deployments, and AWS S3 storage for production deployments requiring scalability and reliability.

### Storage Service Interface

```java
public interface StorageService {
    /**
     * Store a file and return its path/URL.
     */
    String store(MultipartFile file, String filename);
    
    /**
     * Delete a file by its stored path/URL.
     */
    void delete(String filepath);
    
    /**
     * Get the download URL for a stored file.
     */
    String getUrl(String filepath);
}
```

### LocalStorageService

```
Configuration: app.storage.type=local (default)

Storage Path: uploads/{UUID_originalname.ext}
Serving: Spring resource handler at /uploads/**
         (configured in WebConfig.java)

File URL: http://localhost:8080/uploads/{UUID_originalname.ext}
```

### S3StorageService

```
Configuration: app.storage.type=s3
Environment Variables Required:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_S3_BUCKET

Storage: Amazon S3 bucket
File URL: https://{bucket}.s3.{region}.amazonaws.com/{UUID_originalname.ext}
```

### Configuration Switching

Storage type is switched via a single property:
```properties
# application.properties
app.storage.type=${STORAGE_TYPE:local}
```

At startup, the active storage implementation is injected based on this property. The rest of the application interacts with `StorageService` interface only, completely unaware of which implementation is active.

---

## 18. Testing Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Test Directory** | `src/test/java/com/ticket/ticket_system/` |
| **Key Files** | `AbstractIntegrationTest.java`, `application-test.properties` |
| **Coverage Tool** | JaCoCo (70% instruction, 60% branch) |
| **Architecture Testing** | ArchUnit |

### Overview

The Testing Module provides comprehensive test coverage across multiple levels: unit tests (service and controller logic), integration tests (database interactions with TestContainers), and architecture tests (structural rules with ArchUnit). The module ensures code quality and prevents regressions.

### Test Levels

```
Test Pyramid
     ╱╲
    ╱  ╲         Architecture Tests (6)
   ╱    ╲
  ╱──────╲       Integration Tests (30)
 ╱────────╲
╱──────────╲     Unit Tests (51)
```

### Unit Tests (51 tests)

| Test Class | Count | What It Tests |
|---|---|---|
| `AuthControllerTest` | 8 | Login with valid/invalid credentials, account lockout, inactive user, signup, forgot/reset password, OTP verification |
| `TicketServiceTest` | 16 | Ticket creation, assignment, status changes, commenting, deletion, edge cases |
| `UserServiceTest` | 20 | User CRUD, password changes, soft delete, duplicate checks, edge cases |
| `RefreshTokenServiceTest` | 7 | Token creation, finding, rotation, revocation |

### Integration Tests (30 tests)

| Test Class | Count | What It Tests |
|---|---|---|
| `TicketRepositoryTest` | 11 | Database queries for tickets by org, assignee, status, unassigned, counts |
| `UserRepositoryTest` | 10 | Database queries for users by username, email, role, org, photo updates |
| `AuthIntegrationTest` | 9 | Full auth flow end-to-end: signup → login → /me → refresh → logout, validation errors, inactive user locks |

Integration tests use PostgreSQL TestContainers — a real PostgreSQL database running in Docker — ensuring the queries work against a real database, not an in-memory mock.

### Architecture Tests (6 rules)

```java
@Test
void services_should_only_be_accessed_by_controllers() { ... }

@Test
void controllers_should_only_depend_on_services() { ... }

@Test
void repositories_should_only_be_accessed_by_services() { ... }

@Test
void entities_should_not_depend_on_other_layers() { ... }

@Test
void service_classes_should_be_annotated_with_Transactional() { ... }

@Test
void rest_controllers_should_be_annotated_with_Tag() { ... }
```

### Test Configuration

```properties
# application-test.properties
spring.jpa.hibernate.ddl-auto=create-drop    # Create schema from entities
spring.flyway.enabled=false                  # Skip Flyway migrations
spring.jpa.show-sql=false                     # Keep test output clean
spring.data.redis.repositories.enabled=false  # Disable Redis repos
spring.main.allow-bean-definition-overriding=true  # Allow test overrides
```

### Coverage Threshold

```xml
<!-- JaCoCo configuration -->
<rule>
    <element>BUNDLE</element>
    <limits>
        <limit>
            <counter>INSTRUCTION</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.70</minimum>  <!-- 70% instruction coverage -->
        </limit>
        <limit>
            <counter>BRANCH</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.60</minimum>  <!-- 60% branch coverage -->
        </limit>
    </limits>
</rule>
```

---

## 19. Deployment Module

### Module Identity

| Attribute | Detail |
|---|---|
| **Key Files** | `Dockerfile`, `docker-compose.yml`, `k8s/` (6 manifest files), `.github/workflows/deploy.yml` |
| **Key Config** | `pom.xml` (build plugins), `application-prod.properties` |

### Overview

The Deployment Module encapsulates all infrastructure-as-code and CI/CD configuration needed to build, test, and deploy the system. It supports Docker containerization, Kubernetes orchestration, and GitHub Actions CI/CD.

### Docker Containerization

```dockerfile
# Multi-stage build
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline -B    # Cache dependencies
COPY src ./src
RUN mvn package -DskipTests -B       # Build JAR

FROM eclipse-temurin:17-jre          # Minimal runtime image
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
COPY uploads ./uploads
RUN mkdir -p uploads && chown -R app:app /app
USER app                              # Non-root user
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Docker Compose

```yaml
services:
  postgres:
    image: postgres:17-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME:-postgres} -d ticket_system"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_URL: jdbc:postgresql://postgres:5432/ticket_system
      DB_PASSWORD: ${DB_PASSWORD}  # no fallback — must be set in .env
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - uploads:/app/uploads
      # logs volume removed — logs go to stdout via docker logs
```

### Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                     │
│                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │  Ingress    │   │  Service    │   │  HPA        │   │
│  │  (nginx)    │──>│  (ClusterIP)│   │  (2-10 pods)│   │
│  └─────────────┘   └──────┬──────┘   └─────────────┘   │
│                           │                              │
│              ┌────────────┴────────────┐                 │
│              │         Pod             │                 │
│              │  ┌──────────────────┐  │                 │
│              │  │  ticket-system   │  │                 │
│              │  │  app container   │  │                 │
│              │  │  :8080           │  │                 │
│              │  └──────────────────┘  │                 │
│              └────────────────────────┘                 │
│                                                          │
│  ┌─────────────┐   ┌─────────────┐                     │
│  │  ConfigMap  │   │  Secret     │                     │
│  │  (env vars) │   │  (passwords)│                     │
│  └─────────────┘   └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline (GitHub Actions)

```
Events: push to main
─────────────────
Step 1: Checkout code
Step 2: Set up JDK 17
Step 3: Run tests (with TestContainers PostgreSQL + Redis service)
Step 4: Build Docker image
Step 5: Push to Docker Hub
```

### Environment Variables Reference

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SERVER_PORT` | No | 8080 | HTTP server port |
| `SPRING_PROFILES_ACTIVE` | No | dev | Active configuration profile |
| `DB_URL` | No | jdbc:postgresql://localhost:5432/ticket_system | PostgreSQL JDBC URL |
| `DB_USERNAME` | No | postgres | Database username |
| `DB_PASSWORD` | No | Admin123@ | Database password |
| `JWT_SECRET` | **Yes** | — | HMAC secret for JWT (min 32 chars) |
| `JWT_EXPIRATION` | No | 900000 | JWT expiry in milliseconds (15 min) |
| `CORS_ALLOWED_ORIGINS` | No | http://localhost:5173 | Allowed CORS origins |
| `STORAGE_TYPE` | No | local | File storage backend (local/s3) |
| `AWS_ACCESS_KEY_ID` | If S3 | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | If S3 | — | AWS secret key |
| `AWS_S3_BUCKET` | If S3 | — | S3 bucket name |
| `SENTRY_DSN` | No | — | Sentry error tracking DSN |
| `SPRING_MAIL_*` | For password reset | — | Email server configuration |
