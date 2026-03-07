# CVBuilder -- Technical Documentation

## Overview

CVBuilder is an online CV/resume builder that lets users create, edit, and export professional CVs using Typst templates. Users select from a library of templates, fill in their details via a web editor, and generate PDF output via Typst compilation. The platform features user authentication, an admin dashboard for template and user management, and a freemium model with free basic templates and paid premium templates.

**Target market:** Job seekers in Switzerland and Europe who want professional, ATS-optimized CVs.
**Value proposition:** Browser-based CV editor with professional Typst templates, instant PDF export, and privacy-first approach.

## Architecture

```
Client (Browser)
    |
    v
Caddy (reverse proxy, port 80, .local domain)
    |
    v
Fastify (port 4001)
    |
    +---> PostgreSQL (stz_cvbuilder) via Drizzle ORM + raw pg Pool
    |
    +---> Typst CLI (PDF compilation)
    |
    +---> Filesystem (PDF temp files)
```

### Request flow

1. Client sends HTTP request to Caddy reverse proxy
2. Caddy forwards to Fastify on port 4001
3. Middleware chain: cookie parse -> JWT verify -> route handler
4. Route handler uses Drizzle ORM for DB queries
5. EJS template rendered server-side and returned to client
6. PDF generation: Typst template + user data -> `typst compile` -> PDF stream

### Directory structure

```
cv-builder/
  app/
    src/
      server.js              # Fastify app, plugins, hooks, homepage
      db/
        index.js             # Drizzle instance + pg Pool export
        schema.js            # Drizzle ORM table definitions (3 tables)
        migrate.js           # Schema migration runner
        seed.js              # Seed data (templates)
      routes/
        auth.js              # Register, login, logout (JWT in cookie)
        cv.js                # CRUD for CVs + PDF generation
        templates.js         # Template listing
        admin.js             # Dashboard, users, templates, logs
      views/                 # EJS templates
      public/                # Static assets
    data/
      pdfs/                  # Temp PDF storage (gitignored)
    package.json
```

## Tech Stack

| Component        | Technology                                    |
|-----------------|----------------------------------------------|
| Runtime         | Node.js (ESM)                                 |
| Framework       | Fastify 5                                      |
| Template Engine | EJS via @fastify/view                          |
| Database        | PostgreSQL (Drizzle ORM + raw pg Pool)         |
| Auth            | JWT (jsonwebtoken) in httpOnly cookies          |
| Password Hash   | bcryptjs (12 rounds)                            |
| PDF Engine      | Typst CLI (external binary, `typst compile`)    |
| ORM             | Drizzle ORM 0.36                                |
| Static Files    | @fastify/static                                 |

### Dependencies

- `fastify` ^5.0.0
- `@fastify/static` ^8.0.0
- `@fastify/formbody` ^8.0.0
- `@fastify/cookie` ^11.0.0
- `@fastify/view` ^10.0.0
- `ejs` ^3.1.10
- `pg` ^8.13.0
- `drizzle-orm` ^0.36.0
- `bcryptjs` ^2.4.3
- `jsonwebtoken` ^9.0.2

Dev dependencies:
- `drizzle-kit` ^0.30.0

## Database Schema

### Tables

#### users
| Column       | Type          | Constraints               |
|-------------|---------------|---------------------------|
| id          | SERIAL        | PRIMARY KEY                |
| email       | VARCHAR(255)  | NOT NULL, UNIQUE           |
| passwordHash| TEXT          | NOT NULL                   |
| name        | VARCHAR(255)  | NOT NULL                   |
| role        | VARCHAR(20)   | DEFAULT 'user'             |
| banned      | BOOLEAN       | DEFAULT false              |
| bannedReason| TEXT          |                            |
| createdAt   | TIMESTAMP     | DEFAULT NOW(), NOT NULL    |

#### templates
| Column       | Type          | Constraints               |
|-------------|---------------|---------------------------|
| id          | SERIAL        | PRIMARY KEY                |
| name        | VARCHAR(100)  | NOT NULL                   |
| description | TEXT          |                            |
| typstTemplate| TEXT         | NOT NULL                   |
| previewUrl  | VARCHAR(500)  |                            |
| createdAt   | TIMESTAMP     | DEFAULT NOW(), NOT NULL    |

#### cvs
| Column     | Type          | Constraints                     |
|-----------|---------------|----------------------------------|
| id        | SERIAL        | PRIMARY KEY                       |
| userId    | INTEGER       | NOT NULL, FK -> users(id)         |
| templateId| INTEGER       | FK -> templates(id)               |
| title     | VARCHAR(255)  | NOT NULL, DEFAULT 'My CV'         |
| data      | JSONB         | NOT NULL, DEFAULT {}              |
| pdfPath   | VARCHAR(500)  |                                   |
| createdAt | TIMESTAMP     | DEFAULT NOW(), NOT NULL           |
| updatedAt | TIMESTAMP     | DEFAULT NOW(), NOT NULL           |

#### admin_logs (admin migration)
| Column         | Type         | Constraints                |
|---------------|--------------|----------------------------|
| id            | SERIAL       | PRIMARY KEY                 |
| admin_id      | INTEGER      | FK -> users(id)             |
| action        | VARCHAR(100) | NOT NULL                    |
| target_user_id| INTEGER      | FK -> users(id)             |
| details       | TEXT         |                             |
| created_at    | TIMESTAMP    | DEFAULT NOW()               |

### ER Diagram

```
  +----------+        +-----------+        +----------+
  |  users   |<-------+    cvs    +------->| templates|
  +----------+  1:N   +-----------+  N:1   +----------+
  | id (PK)  |        | id (PK)   |        | id (PK)  |
  | email    |        | userId    |        | name     |
  | name     |        | templateId|        | typst    |
  | role     |        | title     |        | preview  |
  | banned   |        | data (JSON)|       +----------+
  +----+-----+        | pdfPath   |
       |              +-----------+
       |
       v
  +------------+
  | admin_logs |
  +------------+
  | admin_id   |
  | action     |
  | target_id  |
  | details    |
  +------------+
```

## API Routes

### Auth (`/auth`)
| Method | Path           | Auth | Description                          |
|--------|---------------|------|--------------------------------------|
| GET    | /auth/login    | No   | Login form                            |
| POST   | /auth/login    | No   | Login with email/password (rate limited) |
| GET    | /auth/register | No   | Registration form                     |
| POST   | /auth/register | No   | Register (rate limited)               |
| GET    | /auth/logout   | No   | Clear cookie and redirect             |

### CV (`/cv`)
| Method | Path           | Auth | Description                          |
|--------|---------------|------|--------------------------------------|
| GET    | /cv            | Yes  | List user's CVs                       |
| GET    | /cv/new        | Yes  | New CV editor (template selection)    |
| POST   | /cv/save       | Yes  | Save CV (create or update)            |
| GET    | /cv/edit/:id   | Yes  | Edit existing CV                      |
| GET    | /cv/pdf/:id    | Yes  | Generate and download PDF             |
| POST   | /cv/delete/:id | Yes  | Delete CV                             |

### Templates (`/templates`)
| Method | Path       | Auth | Description              |
|--------|-----------|------|--------------------------|
| GET    | /templates | No   | List all templates        |

### Admin (`/admin`)
| Method | Path                      | Auth  | Description                    |
|--------|--------------------------|-------|--------------------------------|
| GET    | /admin                    | Admin | Dashboard (users, templates, CVs counts) |
| GET    | /admin/users              | Admin | User list (search by email/name) |
| POST   | /admin/users/:id/role     | Owner | Change user role                |
| POST   | /admin/users/:id/ban      | Admin | Ban user                        |
| POST   | /admin/users/:id/unban    | Admin | Unban user                      |
| GET    | /admin/templates          | Admin | Template management (with usage counts) |
| GET    | /admin/logs               | Admin | Activity log (100 most recent)  |

### Other
| Method | Path    | Auth | Description                    |
|--------|---------|------|--------------------------------|
| GET    | /       | No   | Homepage                        |
| GET    | /faq    | No   | FAQ page                        |
| GET    | /health | No   | Health check endpoint           |

## Authentication & Authorization

### Auth flow
1. User registers with email, name, password
2. Password hashed with bcryptjs (12 rounds)
3. JWT signed with `JWT_SECRET`, contains: `userId`, `email`, `name`, `role`
4. JWT stored in httpOnly cookie (`token`), 7-day expiry
5. Auth middleware in auth routes: cookie parsed -> JWT verified -> `request.user` populated
6. Banned check on login: returns banned view with reason

### Role hierarchy
- **owner** > **admin** > **user**
- `admin@stuzzicadenti.ch` auto-promoted to owner on startup
- Only owners can change roles
- Owners cannot have their role changed
- Cannot ban yourself or the owner

### Admin auth
- Admin routes verify JWT then query DB for current role (not JWT claim)
- Both `admin` and `owner` roles have access
- All role checks use fresh DB data

### Rate limiting
- In-memory per-IP: 10 attempts per 15-minute window on auth endpoints
- Map cleanup every 60 seconds
- Returns 429 when exceeded

## Security Measures

### Password hashing
- bcryptjs with 12 salt rounds

### Security headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### SQL injection prevention
- Drizzle ORM parameterized queries for all standard operations
- Raw pg Pool queries use `$1`, `$2` placeholders
- ILIKE search parameters properly escaped with parameterized queries

### Input validation
- Email regex validation
- Password: 8-1000 characters
- Name: max 255 characters
- Email: max 255 characters
- CV title: max 255 characters
- CV data: max 500,000 characters (JSON string)
- Template ID: parsed as integer, validated positive
- CV ID: parsed as integer, validated positive (`parseId()` helper)

### PDF generation security
- Uses `execFile` (not `exec`) to prevent shell injection
- Temp files created in isolated directory per CV
- Temp files cleaned up after generation (success or failure)
- PDF filename sanitized (non-alphanumeric chars stripped)

### Cookie security
- `httpOnly: true`
- `sameSite: lax`
- `secure: false` (behind Caddy/Tailscale)
- 7-day max age

### Body size limit
- 1 MB max request body

### Error handling
- Global error handler suppresses stack traces in production
- Returns generic message in production, detailed in development

## Admin System

### Dashboard metrics
- Total users count
- Total templates count
- Total CVs count
- 10 most recent users
- 10 most recent CVs (with creator email)

### User management
- Search by email or name (ILIKE)
- Role changes: owner only, valid roles: user, admin
- Ban: sets `banned=true` with reason
- Unban: clears ban status and reason
- Cannot ban yourself, cannot ban the owner

### Template management
- View all templates with creation dates
- Usage count per template (number of CVs using each)

### Activity logging
- `admin_logs` table records all admin actions
- Logged actions: role_change, ban, unban
- Includes admin_id, target_user_id, details, timestamp
- 100 most recent entries displayed with admin and target emails

## Swiss Legal Compliance

### Data Protection (DSG/FADP)

Swiss Federal Act on Data Protection (Datenschutzgesetz, DSG, SR 235.1):

CVBuilder handles sensitive personal data contained in CVs (name, contact info, work history, education, skills). Compliance measures:

- **Data minimization**: Only email, name, and password required for registration
- **CV data storage**: CV content stored as JSONB in PostgreSQL, encrypted at rest by database
- **Password security**: bcrypt hashed (12 rounds), never stored in plaintext
- **PDF generation**: Temporary files created and deleted immediately after download
- **No third-party sharing**: CV data never sent to external services
- **Right to deletion**: Users can delete individual CVs; admin can delete accounts
- **Data portability**: CV data stored as structured JSON, exportable
- **Access control**: CVs accessible only by owner (enforced by `userId` check on all queries)
- **Admin access**: Admins can view metadata (titles, counts) but not CV content

### Subscription Terms (OR)

Swiss Code of Obligations (Obligationenrecht, OR, SR 220):

- **Clear pricing**: Freemium model with transparent tier descriptions
- **Free tier**: Basic templates available without payment
- **Paid tiers**: Terms clearly stated before purchase
- **Cancellation**: Users can cancel at any time

### Right to Data Deletion

Per Art. 32 DSG (right to erasure):

- Users can delete their CVs via `POST /cv/delete/:id`
- Users can request full account deletion (admin action)
- PDF temp files are automatically cleaned up
- No data retention beyond what is necessary for the service

### Typst Template Safety

- Templates are admin-managed (not user-uploaded)
- Typst compilation runs in a sandboxed `execFile` call
- No network access during compilation
- User data injected as JSON file (not inline in Typst source)

## Business Model

### Revenue streams
1. **Freemium subscriptions**:
   - Free: Basic templates, limited CVs
   - Pro: All templates, unlimited CVs, AI suggestions (EUR 2.99/mo)
   - Enterprise: Team management, bulk generation, API (EUR 49/mo)
2. **One-time services**:
   - CV Review: EUR 4.99 (professional human review)
   - CV Writing: From EUR 29 (expert writes CV)

### Template system
- Templates stored as Typst source in database
- Admin-managed via dashboard
- Each template has: name, description, Typst source, preview URL
- Users select template when creating/editing CV
- Data injected via JSON file into Typst compilation

## Deployment

### Docker container
- Runs via Docker on Mac Mini (Portainer)
- Caddy reverse proxy maps `.local` domain to port 4001
- Tailscale network for team access
- Requires `typst` binary installed in container

### Environment variables
| Variable      | Description                    | Default                                              |
|--------------|--------------------------------|------------------------------------------------------|
| PORT         | Server port                     | 4001                                                  |
| DATABASE_URL | PostgreSQL connection string    | postgresql://cvbuilder_app:cvbuilder_pass@localhost:5432/stz_cvbuilder |
| JWT_SECRET   | JWT signing secret              | dev-jwt-secret-change-me                              |
| COOKIE_SECRET| Cookie signing secret           | dev-secret-change-me                                  |
| PDF_DIR      | PDF temp file directory         | ../../data/pdfs                                        |
| NODE_ENV     | Environment                     | (not set)                                             |
| HOST         | Bind address                    | 0.0.0.0                                               |

### Health check
- `GET /health` returns `{ status: 'ok', service: 'stz-cvbuilder' }`

### Graceful shutdown
- Handles SIGTERM and SIGINT
- Closes Fastify server, then PostgreSQL pool

## User Flows

### Create CV -> Choose Template -> Export PDF

```
  Register / Login
      |
      v
  My CVs (/cv)
  (list of existing CVs)
      |
      +---> New CV (/cv/new)
      |     |
      |     v
      |     Browse templates
      |     (or pre-select from /templates page)
      |     |
      |     v
      |     CV Editor
      |     (fill in personal info, experience, education, skills)
      |     |
      |     v
      |     Save CV (POST /cv/save)
      |     (data stored as JSONB)
      |
      +---> Edit CV (/cv/edit/:id)
      |     (modify existing CV data)
      |
      +---> Export PDF (/cv/pdf/:id)
      |     |
      |     v
      |     Server: load template + CV data
      |     |
      |     v
      |     Write data.json + cv.typ to temp dir
      |     |
      |     v
      |     typst compile cv.typ cv.pdf
      |     |
      |     v
      |     Stream PDF to browser
      |     |
      |     v
      |     Cleanup temp files
      |
      +---> Delete CV (POST /cv/delete/:id)
```

### Template Selection Flow

```
  /templates
  (browse all available templates with previews)
      |
      v
  Click "Use This Template"
      |
      v
  /cv/new?template=:id
  (editor pre-loaded with selected template)
```

## Monitoring & Logging

### Activity logs
- `admin_logs` table records admin actions (role changes, bans, unbans)
- 100 most recent entries in admin panel
- Includes admin email, target email, action details

### Error handling
- Global Fastify error handler (sanitized in production)
- PDF generation errors caught with cleanup
- Database errors caught per-route

### Health check
- `GET /health` endpoint for monitoring
- Returns service name and status
