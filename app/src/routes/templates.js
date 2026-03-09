import { db } from '../db/index.js';
import { templates } from '../db/schema.js';

export default async function templateRoutes(app) {
  // Template gallery — public page showing all templates with previews
  app.get('/', async (req, reply) => {
    const allTemplates = await db.select().from(templates);
    return reply.view('templates/list.ejs', { user: req.user, templates: allTemplates, title: 'Templates', t: req.t, lang: req.lang });
  });
}
