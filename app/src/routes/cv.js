import { db } from '../db/index.js';
import { cvs, templates } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = process.env.PDF_DIR || path.join(__dirname, '../../data/pdfs');

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function cvRoutes(app) {
  // Require auth for all CV routes
  app.addHook('preHandler', async (req, reply) => {
    if (!req.user) return reply.redirect('/auth/login');
  });

  // List user's CVs
  app.get('/', async (req, reply) => {
    const userCvs = await db.select().from(cvs).where(eq(cvs.userId, req.user.id)).orderBy(cvs.updatedAt);
    return reply.view('cv/list.ejs', { user: req.user, cvs: userCvs, title: 'My CVs' });
  });

  // New CV form
  app.get('/new', async (req, reply) => {
    const allTemplates = await db.select().from(templates);
    return reply.view('cv/editor.ejs', { user: req.user, cv: null, templates: allTemplates, title: 'New CV' });
  });

  // Save CV
  app.post('/save', async (req, reply) => {
    const { id, title, templateId, data } = req.body;
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

  // Edit CV
  app.get('/edit/:id', async (req, reply) => {
    const parsedId = parseId(req.params.id);
    if (!parsedId) return reply.code(400).send('Invalid CV id');
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, parsedId), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');
    const allTemplates = await db.select().from(templates);
    return reply.view('cv/editor.ejs', { user: req.user, cv, templates: allTemplates, title: `Edit: ${cv.title}` });
  });

  // Generate PDF
  app.get('/pdf/:id', async (req, reply) => {
    const [cv] = await db.select().from(cvs)
      .where(and(eq(cvs.id, parseInt(req.params.id)), eq(cvs.userId, req.user.id))).limit(1);
    if (!cv) return reply.code(404).send('CV not found');

    const [template] = await db.select().from(templates).where(eq(templates.id, cv.templateId)).limit(1);
    if (!template) return reply.code(400).send('No template selected');

    // Build Typst source with data
    const typstSource = `#let data = json("data.json")\n${template.typstTemplate}`;

    await fs.mkdir(PDF_DIR, { recursive: true });
    const tmpDir = path.join(PDF_DIR, `tmp-${cv.id}-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const dataPath = path.join(tmpDir, 'data.json');
    const typstPath = path.join(tmpDir, 'cv.typ');
    const pdfPath = path.join(tmpDir, 'cv.pdf');

    await fs.writeFile(dataPath, JSON.stringify(cv.data));
    await fs.writeFile(typstPath, typstSource);

    try {
      await execFileAsync('typst', ['compile', typstPath, pdfPath]);
      const pdf = await fs.readFile(pdfPath);

      // Cleanup temp files
      await fs.rm(tmpDir, { recursive: true, force: true });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${cv.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf"`);
      return reply.send(pdf);
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      app.log.error(err);
      return reply.code(500).send('PDF generation failed: ' + err.message);
    }
  });

  // Delete CV
  app.post('/delete/:id', async (req, reply) => {
    await db.delete(cvs).where(and(eq(cvs.id, parseInt(req.params.id)), eq(cvs.userId, req.user.id)));
    return reply.redirect('/cv');
  });
}
