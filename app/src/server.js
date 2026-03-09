import Fastify from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import formbody from '@fastify/formbody';
import cookie from '@fastify/cookie';
import view from '@fastify/view';
import fstatic from '@fastify/static';
import ejs from 'ejs';
import { db, pool } from './db/index.js';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.js';
import cvRoutes from './routes/cv.js';
import templateRoutes from './routes/templates.js';
import adminRoutes from './routes/admin.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 1048576, // 1 MB max body size
});

// Security headers
app.addHook('onSend', async (request, reply) => {
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '0');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'");
  reply.removeHeader('X-Powered-By');
});

// Rate limiting for auth routes (in-memory, per IP)
const authAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of authAttempts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) authAttempts.delete(key);
  }
}, 60 * 1000);

app.decorate('checkAuthRateLimit', (request, reply) => {
  const ip = request.ip;
  const now = Date.now();
  let entry = authAttempts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 0, windowStart: now };
    authAttempts.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    reply.code(429).send('Too many attempts. Please try again later.');
    return false;
  }
  return true;
});

// Global error handler — don't leak internals in production
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred.'
    : error.message;
  reply.code(statusCode).send({ error: message });
});

// Plugins
await app.register(formbody);
await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'dev-secret-change-me' });
await app.register(view, {
  engine: { ejs },
  root: path.join(__dirname, 'views'),
  production: process.env.NODE_ENV === 'production',
});
await app.register(fstatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
  maxAge: process.env.NODE_ENV === 'production' ? 86400000 : 0,
});

// i18n — load locale files once at startup
const SUPPORTED_LANGS = ['en', 'it', 'de', 'fr'];
const locales = {};
for (const lang of SUPPORTED_LANGS) {
  const filePath = path.join(__dirname, 'locales', `${lang}.json`);
  locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// i18n preHandler — reads lang cookie, provides t() helper
app.decorateRequest('lang', 'en');
app.decorateRequest('t', null);
app.addHook('preHandler', async (req) => {
  const cookieLang = req.cookies?.lang;
  const lang = SUPPORTED_LANGS.includes(cookieLang) ? cookieLang : 'en';
  req.lang = lang;
  const strings = locales[lang];
  const fallback = locales['en'];
  req.t = (key) => strings[key] || fallback[key] || key;
});

// Auth decorator — decode JWT on every request (non-blocking)
app.decorateRequest('user', null);
app.addHook('preHandler', async (req) => {
  const token = req.cookies?.token;
  if (!token) return;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, email: payload.email, name: payload.name, role: payload.role || 'user' };
  } catch { req.user = null; }
});

// Routes
await app.register(authRoutes, { prefix: '/auth' });
await app.register(cvRoutes, { prefix: '/cv' });
await app.register(templateRoutes, { prefix: '/templates' });
await app.register(adminRoutes, { prefix: '/admin' });

// Language switch route
app.get('/lang/:code', async (req, reply) => {
  const code = req.params.code;
  if (SUPPORTED_LANGS.includes(code)) {
    reply.setCookie('lang', code, { path: '/', httpOnly: false, maxAge: 365 * 24 * 60 * 60, sameSite: 'lax' });
  }
  // Only allow relative redirects — reject absolute URLs to prevent open redirect
  const referer = req.headers.referer || '/';
  let redirectTo = '/';
  try {
    const url = new URL(referer, 'http://localhost');
    redirectTo = url.pathname + url.search + url.hash;
  } catch { /* fall back to '/' */ }
  return reply.redirect(redirectTo);
});

// Home page
app.get('/', async (req, reply) => {
  const user = req.user || null;
  return reply.view('index.ejs', { user, title: 'CV Builder', t: req.t, lang: req.lang });
});

// FAQ page
app.get('/faq', async (req, reply) => {
  const user = req.user || null;
  return reply.view('faq.ejs', { user, title: 'FAQ', t: req.t, lang: req.lang });
});

// Health check
app.get('/health', async () => ({ status: 'ok', service: 'stz-cvbuilder' }));

// Graceful shutdown
const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

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
