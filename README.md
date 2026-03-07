# CV Builder

Free professional CV/resume builder — Europass, LaTeX, Typst templates with ATS optimization.

## Overview

CV Builder is a free, privacy-first tool for creating professional CVs and resumes. It supports Europass, LaTeX, and Typst formats with ATS-optimized output. Your data stays in your browser — no server-side storage unless you opt in.

## Features

- **6 Professional Templates** — Europass, Modern Minimal, Academic LaTeX, Creative Typst, Tech Professional, Executive
- **Multiple Formats** — Europass, LaTeX, Typst, PDF export
- **ATS-Optimized** — All templates pass Applicant Tracking Systems
- **Privacy-First** — Data stays in your browser
- **Multi-Language** — EN, IT, DE, FR, ES support
- **Open Source Core** — Self-host the entire application

## Tech Stack

- HTML5 + CSS3 (vanilla, no frameworks)
- GitHub Pages (static hosting)
- GitHub Actions CI/CD

## Architecture

```
cv-builder/
├── src/
│   ├── index.html          # Landing page
│   ├── css/
│   │   └── style.css       # Styles
│   └── robots.txt          # Search engine directives
├── .github/
│   └── workflows/
│       ├── deploy.yml       # GitHub Pages deployment
│       └── lint.yml         # HTML validation + secret detection
├── .gitignore
└── README.md
```

## Deployment

| Branch | Environment | URL |
|--------|------------|-----|
| `dev` | Preview | Auto-deployed on push |
| `main` | Production | [stuzzicadenti-ag.github.io/cv-builder](https://stuzzicadenti-ag.github.io/cv-builder/) |

## CI/CD Pipeline

```
Push to dev  ──→ Lint ──→ Deploy Preview
Push to main ──→ Lint ──→ Deploy Production
```

## Development

```bash
git clone https://github.com/stuzzicadenti-ag/cv-builder.git
cd cv-builder
open src/index.html
```

## Pricing Model

| Plan | Price | Features |
|------|-------|----------|
| Self-Hosted | Free forever | Full source, run locally, complete privacy |
| Managed Free | Free | 1 CV, basic templates, PDF export |
| Pro | EUR 2.99/mo | Unlimited CVs, all templates, AI suggestions |
| Enterprise | EUR 49/mo | Team management, bulk generation, API, SSO |
| CV Review | EUR 4.99 one-time | Professional human review with feedback |
| CV Writing | From EUR 29 | Expert writes your CV from scratch |

## Roadmap

- [ ] i18n support (DE, FR, IT, EN)
- [ ] Typst/LaTeX compilation engine
- [ ] User authentication and CV storage
- [ ] AI-powered content suggestions
- [ ] Real-time preview
- [ ] Mobile-responsive editor

## License

All rights reserved. Copyright 2026 Stuzzicadenti AG.
