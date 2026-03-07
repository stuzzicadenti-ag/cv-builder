import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import formbody from '@fastify/formbody';
import cookie from '@fastify/cookie';
import view from '@fastify/view';
import fstatic from '@fastify/static';
import ejs from 'ejs';
import { db } from './db/index.js';
import authRoutes from './routes/auth.js';
import cvRoutes from './routes/cv.js';
import templateRoutes from './routes/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: true,
  trustProxy: true
});

// Plugins
await app.register(formbody);
await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'dev-secret-change-me' });
await app.register(view, { engine: { ejs }, root: path.join(__dirname, 'views') });
await app.register(fstatic, { root: path.join(__dirname, 'public'), prefix: '/public/' });

// Routes
await app.register(authRoutes, { prefix: '/auth' });
await app.register(cvRoutes, { prefix: '/cv' });
await app.register(templateRoutes, { prefix: '/templates' });

// Home page
app.get('/', async (req, reply) => {
  const user = req.user || null;
  return reply.view('index.ejs', { user, title: 'CV Builder' });
});

// Health check
app.get('/health', async () => ({ status: 'ok', service: 'stz-cvbuilder' }));

// Start
const port = parseInt(process.env.PORT || '4001');
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`CV Builder running on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
