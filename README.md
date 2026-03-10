# CVBuilder

Online CV/resume builder with professional Typst templates, browser-based editing, and instant PDF export. Users create CVs by selecting templates, filling in structured data, and generating ATS-optimized PDFs. Features user authentication, an admin dashboard for template management, and a freemium model.

## Quick Start

```bash
cd app
npm install
# Set environment variables (see below)
npm run db:migrate
npm run db:seed
npm start
```

### Environment Variables

| Variable      | Description                 | Default |
|--------------|-----------------------------|---------|
| PORT         | Server port                  | 4001    |
| DATABASE_URL | PostgreSQL connection string | postgresql://cvbuilder_app:cvbuilder_pass@localhost:5432/stz_cvbuilder |
| JWT_SECRET   | JWT signing secret           | dev-jwt-secret-change-me |
| COOKIE_SECRET| Cookie signing secret        | dev-secret-change-me |
| PDF_DIR      | PDF temp file directory      | ../../data/pdfs |

**Note**: Requires `typst` binary installed for PDF generation.

## Documentation

See [DOCS.md](DOCS.md) for full technical documentation, architecture, database schema, API routes, legal compliance, and deployment details.

## Features

- **Template gallery**: Browse and preview professional CV templates
- **Browser-based editor**: Structured form for personal info, experience, education, skills, languages
- **Instant PDF export**: Typst compilation to ATS-optimized PDF
- **Multiple CVs**: Create and manage several CVs per account
- **JSONB data storage**: Flexible CV structure adapts to any template
- **Admin template management**: Create/edit Typst templates with preview
- **User management**: Ban system, role management
- **i18n**: English, Italian, German, French with language dropdown
- **Responsive nav**: Profile dropdown, language dropdown, logged-in vs logged-out states

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Fastify 5
- **Template Engine**: EJS
- **Database**: PostgreSQL (Drizzle ORM + raw pg Pool)
- **Auth**: JWT cookies + bcryptjs (12 rounds)
- **PDF Engine**: Typst CLI
- **ORM**: Drizzle ORM 0.36
- **CSS**: External stylesheets (style.css + landing.css)
- **i18n**: Flat JSON locale files (en, it, de, fr)

## Security & Performance

- **JWT secret consolidated**: Single JWT_SECRET env var (removed redundant signing keys)
- **Cookie secure flag**: Dynamic based on NODE_ENV (secure in production, relaxed in dev)
- **Logout via POST**: Changed logout from GET to POST to prevent CSRF log-out attacks
- **Admin ILIKE escaping**: User search input escaped to prevent pattern injection
- **DB startup check**: Connection verified on boot with clear error on failure
- **Docker port binding**: Bound to 127.0.0.1 to prevent external access in development

## License

Proprietary -- Stuzzicadenti AG
