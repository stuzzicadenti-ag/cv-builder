import { db } from '../db/index.js';
import { cvs, templates } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = process.env.PDF_DIR || path.join(__dirname, '../../data/pdfs');

// In-memory rate limiter for PDF generation (max 5 per user per minute)
const PDF_RATE_LIMIT = 5;
const PDF_RATE_WINDOW = 60 * 1000; // 1 minute
const pdfRateLimits = new Map();

// Cleanup stale entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of pdfRateLimits) {
    if (now - entry.windowStart > PDF_RATE_WINDOW) pdfRateLimits.delete(userId);
  }
}, 2 * 60 * 1000);

function checkPdfRateLimit(userId) {
  const now = Date.now();
  let entry = pdfRateLimits.get(userId);
  if (!entry || now - entry.windowStart > PDF_RATE_WINDOW) {
    entry = { count: 0, windowStart: now };
    pdfRateLimits.set(userId, entry);
  }
  entry.count++;
  return entry.count <= PDF_RATE_LIMIT;
}

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build an HTML preview of CV data (styled approximation, not PDF)
function buildPreviewHtml(cv, template) {
  const d = typeof cv.data === 'string' ? JSON.parse(cv.data) : (cv.data || {});
  const e = escapeHtml;

  const sections = [];

  // Header / name
  if (d.name) {
    sections.push(`<h1 style="margin:0 0 4px 0; font-size:1.8rem;">${e(d.name)}</h1>`);
  }

  // Contact line
  const contactParts = [];
  if (d.email) contactParts.push(e(d.email));
  if (d.phone) contactParts.push(e(d.phone));
  if (d.location) contactParts.push(e(d.location));
  if (d.linkedin) contactParts.push(e(d.linkedin));
  if (d.website) contactParts.push(e(d.website));
  if (contactParts.length) {
    sections.push(`<p style="color:#666; font-size:0.9rem; margin:0 0 16px 0;">${contactParts.join(' &bull; ')}</p>`);
  }

  // Additional personal
  const personalParts = [];
  if (d.nationality) personalParts.push(`Nationality: ${e(d.nationality)}`);
  if (d.dateOfBirth) personalParts.push(`DOB: ${e(d.dateOfBirth)}`);
  if (d.drivingLicense) personalParts.push(`License: ${e(d.drivingLicense)}`);
  if (personalParts.length) {
    sections.push(`<p style="color:#888; font-size:0.85rem; margin:0 0 16px 0;">${personalParts.join(' &bull; ')}</p>`);
  }

  // Summary
  if (d.summary) {
    sections.push(`<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Summary</h2><p style="font-size:0.9rem; line-height:1.5;">${e(d.summary)}</p></div>`);
  }

  // Experience
  if (d.experience && d.experience.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Experience</h2>';
    for (const job of d.experience) {
      html += `<div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between;"><strong>${e(job.title)}</strong><span style="color:#666; font-size:0.85rem;">${e(job.dates)}</span></div>
        <div style="color:#555; font-style:italic;">${e(job.company)}</div>
        ${job.description ? `<p style="font-size:0.85rem; margin:4px 0 0 0; white-space:pre-line;">${e(job.description)}</p>` : ''}
      </div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  // Education
  if (d.education && d.education.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Education</h2>';
    for (const edu of d.education) {
      html += `<div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between;"><strong>${e(edu.degree)}</strong><span style="color:#666; font-size:0.85rem;">${e(edu.dates)}</span></div>
        <div style="color:#555;">${e(edu.school)}</div>
      </div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  // Skills
  if (d.skills && d.skills.length) {
    sections.push(`<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Skills</h2><p style="font-size:0.9rem;">${d.skills.map(s => e(s)).join(', ')}</p></div>`);
  }

  // Languages
  if (d.languages && d.languages.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Languages</h2>';
    for (const lang of d.languages) {
      html += `<div style="margin-bottom:4px;">${e(lang.name)}${lang.level ? ` - ${e(lang.level)}` : ''}</div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  // Certifications
  if (d.certifications && d.certifications.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Certifications</h2>';
    for (const cert of d.certifications) {
      html += `<div style="margin-bottom:4px;"><strong>${e(cert.name)}</strong>${cert.issuer ? `, ${e(cert.issuer)}` : ''}${cert.date ? ` (${e(cert.date)})` : ''}</div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  // Projects
  if (d.projects && d.projects.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Projects</h2>';
    for (const proj of d.projects) {
      html += `<div style="margin-bottom:8px;"><strong>${e(proj.name)}</strong>${proj.tech ? ` <span style="color:#888; font-size:0.85rem;">(${e(proj.tech)})</span>` : ''}${proj.url ? ` <span style="font-size:0.85rem;">${e(proj.url)}</span>` : ''}${proj.description ? `<p style="font-size:0.85rem; margin:2px 0 0 0;">${e(proj.description)}</p>` : ''}</div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  // Volunteer
  if (d.volunteer && d.volunteer.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">Volunteer Experience</h2>';
    for (const vol of d.volunteer) {
      html += `<div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between;"><strong>${e(vol.role)}</strong><span style="color:#666; font-size:0.85rem;">${e(vol.dates)}</span></div>
        <div style="color:#555;">${e(vol.organization)}</div>
        ${vol.description ? `<p style="font-size:0.85rem; margin:2px 0 0 0;">${e(vol.description)}</p>` : ''}
      </div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  // References
  if (d.references && d.references.length) {
    let html = '<div style="margin-bottom:20px;"><h2 style="font-size:1.1rem; border-bottom:2px solid #333; padding-bottom:4px; margin-bottom:8px;">References</h2>';
    for (const ref of d.references) {
      html += `<div style="margin-bottom:4px;"><strong>${e(ref.name)}</strong>${ref.position ? `, ${e(ref.position)}` : ''}${ref.company ? `, ${e(ref.company)}` : ''}${ref.contact ? ` (${e(ref.contact)})` : ''}</div>`;
    }
    html += '</div>';
    sections.push(html);
  }

  const templateName = template ? escapeHtml(template.name) : 'Unknown';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(cv.title)} | Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f3f4f6; padding: 32px 16px; }
    .page { max-width: 700px; margin: 0 auto; background: #fff; padding: 48px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); border-radius: 4px; }
    .template-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="template-badge">Template: ${templateName}</div>
    ${sections.join('\n')}
  </div>
</body>
</html>`;
}

export default async function cvRoutes(app) {
  // Require auth for all CV routes EXCEPT public share view
  app.addHook('preHandler', async (req, reply) => {
    // Allow unauthenticated access to public CV view
    if (req.url.startsWith('/cv/public/')) return;
    if (!req.user) return reply.redirect('/auth/login');
  });

  // ─── Public share view (no auth required) ────────────────────────
  app.get('/public/:shareToken', async (req, reply) => {
    const token = req.params.shareToken;
    if (!token || typeof token !== 'string' || token.length > 64) {
      return reply.code(400).send('Invalid share link');
    }
    const [cv] = await db.select().from(cvs).where(and(eq(cvs.shareToken, token), eq(cvs.isPublic, true))).limit(1);
    if (!cv) return reply.code(404).send('CV not found or sharing is disabled');

    const [template] = cv.templateId
      ? await db.select().from(templates).where(eq(templates.id, cv.templateId)).limit(1)
      : [null];

    const html = buildPreviewHtml(cv, template);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  // ─── List user's CVs ─────────────────────────────────────────────
  app.get('/', async (req, reply) => {
    const userCvs = await db.select().from(cvs).where(eq(cvs.userId, req.user.id)).orderBy(cvs.updatedAt);
    return reply.view('cv/list.ejs', { user: req.user, cvs: userCvs, title: 'My CVs', t: req.t, lang: req.lang });
  });

  // ─── New CV form ──────────────────────────────────────────────────
  app.get('/new', async (req, reply) => {
    const allTemplates = await db.select().from(templates);
    // Pre-select template if ?template= query param is provided
    const preselectedTemplateId = req.query.template ? parseId(req.query.template) : null;
    const cvStub = preselectedTemplateId ? { templateId: preselectedTemplateId, title: 'My CV', data: {} } : null;
    return reply.view('cv/editor.ejs', { user: req.user, cv: cvStub, templates: allTemplates, title: 'New CV', t: req.t, lang: req.lang });
  });

  // ─── Save CV ──────────────────────────────────────────────────────
  app.post('/save', async (req, reply) => {
    const { id, title, templateId, data } = req.body;

    if (title && title.length > 255) return reply.code(400).send('Title too long');
    if (typeof data === 'string' && data.length > 500000) return reply.code(400).send('CV data too large');

    let cvData;
    try {
      cvData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      return reply.code(400).send('Invalid CV data');
    }

    const parsedTemplateId = parseId(templateId);
    if (!parsedTemplateId) return reply.code(400).send('Invalid template');

    if (id) {
      const parsedId = parseId(id);
      if (!parsedId) return reply.code(400).send('Invalid CV id');
      await db.update(cvs)
        .set({ title, templateId: parsedTemplateId, data: cvData, updatedAt: new Date() })
        .where(and(eq(cvs.id, parsedId), eq(cvs.userId, req.user.id)));
      return reply.redirect(`/cv/edit/${parsedId}`);
    } else {
      const [newCv] = await db.insert(cvs)
        .values({ userId: req.user.id, title, templateId: parsedTemplateId, data: cvData })
        .returning();
      return reply.redirect(`/cv/edit/${newCv.id}`);
    }
  });

  // ─── Edit CV ──────────────────────────────────────────────────────
  app.get('/edit/:id', async (req, reply) => {
    const parsedId = parseId(req.params.id);
    if (!parsedId) return reply.code(400).send('Invalid CV id');
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, parsedId), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');
    const allTemplates = await db.select().from(templates);
    return reply.view('cv/editor.ejs', { user: req.user, cv, templates: allTemplates, title: `Edit: ${cv.title}`, t: req.t, lang: req.lang });
  });

  // ─── Live Preview (HTML approximation) ────────────────────────────
  app.get('/preview/:id', async (req, reply) => {
    const previewId = parseId(req.params.id);
    if (!previewId) return reply.code(400).send('Invalid CV id');
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, previewId), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');

    const [template] = cv.templateId
      ? await db.select().from(templates).where(eq(templates.id, cv.templateId)).limit(1)
      : [null];

    const html = buildPreviewHtml(cv, template);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  // ─── Duplicate CV ─────────────────────────────────────────────────
  app.post('/duplicate/:id', async (req, reply) => {
    const dupId = parseId(req.params.id);
    if (!dupId) return reply.code(400).send('Invalid CV id');
    const [original] = await db.select().from(cvs)
      .where(and(eq(cvs.id, dupId), eq(cvs.userId, req.user.id))).limit(1);
    if (!original) return reply.code(404).send('CV not found');

    const [copy] = await db.insert(cvs)
      .values({
        userId: req.user.id,
        templateId: original.templateId,
        title: `Copy of ${original.title}`.slice(0, 255),
        data: original.data,
      })
      .returning();
    return reply.redirect(`/cv/edit/${copy.id}`);
  });

  // ─── Export CV as JSON ────────────────────────────────────────────
  app.get('/export/:id', async (req, reply) => {
    const exportId = parseId(req.params.id);
    if (!exportId) return reply.code(400).send('Invalid CV id');
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, exportId), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      title: cv.title,
      templateId: cv.templateId,
      data: cv.data,
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${cv.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json"`);
    return reply.send(JSON.stringify(exportData, null, 2));
  });

  // ─── Import CV from JSON ──────────────────────────────────────────
  app.post('/import', async (req, reply) => {
    const { importData } = req.body;
    if (!importData || typeof importData !== 'string') return reply.code(400).send('No import data provided');
    if (importData.length > 500000) return reply.code(400).send('Import data too large');

    let parsed;
    try {
      parsed = JSON.parse(importData);
    } catch {
      return reply.code(400).send('Invalid JSON');
    }

    if (!parsed.title || !parsed.data || typeof parsed.data !== 'object') {
      return reply.code(400).send('Invalid CV backup format. Must contain "title" and "data" fields.');
    }

    // Validate templateId exists if provided
    let templateId = null;
    if (parsed.templateId) {
      const tid = parseId(String(parsed.templateId));
      if (tid) {
        const [tpl] = await db.select().from(templates).where(eq(templates.id, tid)).limit(1);
        if (tpl) templateId = tid;
      }
    }
    // Fallback: use first template if none matched
    if (!templateId) {
      const [firstTpl] = await db.select().from(templates).limit(1);
      templateId = firstTpl ? firstTpl.id : null;
    }

    const title = String(parsed.title).slice(0, 255) || 'Imported CV';

    const [newCv] = await db.insert(cvs)
      .values({ userId: req.user.id, title, templateId, data: parsed.data })
      .returning();
    return reply.redirect(`/cv/edit/${newCv.id}`);
  });

  // ─── Toggle sharing ───────────────────────────────────────────────
  app.post('/share/:id', async (req, reply) => {
    const shareId = parseId(req.params.id);
    if (!shareId) return reply.code(400).send('Invalid CV id');
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, shareId), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');

    if (cv.isPublic) {
      // Disable sharing
      await db.update(cvs)
        .set({ isPublic: false, shareToken: null, updatedAt: new Date() })
        .where(eq(cvs.id, shareId));
    } else {
      // Enable sharing - generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      await db.update(cvs)
        .set({ isPublic: true, shareToken: token, updatedAt: new Date() })
        .where(eq(cvs.id, shareId));
    }
    return reply.redirect('/cv');
  });

  // ─── Generate PDF (rate limited) ─────────────────────────────────
  app.get('/pdf/:id', async (req, reply) => {
    if (!checkPdfRateLimit(req.user.id)) {
      return reply.code(429).send('Too many PDF requests. Please wait a minute before trying again.');
    }
    const pdfId = parseId(req.params.id);
    if (!pdfId) return reply.code(400).send('Invalid CV id');
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, pdfId), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');

    const [template] = await db.select().from(templates).where(eq(templates.id, cv.templateId)).limit(1);
    if (!template) return reply.code(400).send('No template selected');

    // Build Typst source with data - always inject null-safe helpers
    const helpers = `#let data = json("data.json")
#let get(key, default: "") = if key in data { str(data.at(key)) } else { default }
#let getArr(key) = if key in data and type(data.at(key)) == array { data.at(key) } else { () }
#let has(key) = key in data and str(data.at(key)).len() > 0
#let hasArr(key) = key in data and type(data.at(key)) == array and data.at(key).len() > 0
`;
    // Strip any existing #let data = json(...) from the template to avoid duplicates
    const cleanTemplate = template.typstTemplate.replace(/^\s*#let data\s*=\s*json\([^)]+\)\s*\n?/gm, '');
    const typstSource = helpers + cleanTemplate;

    await fs.mkdir(PDF_DIR, { recursive: true });
    const tmpDir = path.join(PDF_DIR, `tmp-${cv.id}-${crypto.randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const dataPath = path.join(tmpDir, 'data.json');
    const typstPath = path.join(tmpDir, 'cv.typ');
    const pdfPath = path.join(tmpDir, 'cv.pdf');

    // SAFETY: CV data is written as JSON and read by Typst via json("data.json").
    // Typst code injection through user fields (e.g. name="#panic()") is not possible because:
    //   1. JSON.stringify escapes all special characters into a JSON string
    //   2. Typst's json() function parses it as data, not as Typst source code
    //   3. The str() wrapper in get() converts values to plain strings, never evaluated as markup
    await fs.writeFile(dataPath, JSON.stringify(cv.data));
    await fs.writeFile(typstPath, typstSource);

    try {
      await execFileAsync('typst', ['compile', typstPath, pdfPath], { timeout: 15000 });
      const pdf = await fs.readFile(pdfPath);

      // Cleanup temp files
      await fs.rm(tmpDir, { recursive: true, force: true });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${cv.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf"`);
      return reply.send(pdf);
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      app.log.error(err);
      const detail = process.env.NODE_ENV === 'production' ? '' : ': ' + err.message;
      return reply.code(500).send('PDF generation failed' + detail);
    }
  });

  // ─── Delete CV ────────────────────────────────────────────────────
  app.post('/delete/:id', async (req, reply) => {
    const delId = parseId(req.params.id);
    if (!delId) return reply.code(400).send('Invalid CV id');
    await db.delete(cvs).where(and(eq(cvs.id, delId), eq(cvs.userId, req.user.id)));
    return reply.redirect('/cv');
  });
}
