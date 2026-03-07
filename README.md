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

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Fastify 5
- **Template Engine**: EJS
- **Database**: PostgreSQL (Drizzle ORM + raw pg Pool)
- **Auth**: JWT cookies + bcryptjs (12 rounds)
- **PDF Engine**: Typst CLI
- **ORM**: Drizzle ORM 0.36

## License

Proprietary -- Stuzzicadenti AG
