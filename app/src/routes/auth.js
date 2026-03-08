import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const IS_PROD = process.env.NODE_ENV === 'production';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function authRoutes(app) {
  app.get('/login', async (req, reply) => {
    if (req.user) return reply.redirect('/');
    const registered = req.query.registered === '1';
    return reply.view('auth/login.ejs', { user: null, error: null, title: 'Login', registered, t: req.t, lang: req.lang });
  });

  app.post('/login', async (req, reply) => {
    if (app.checkAuthRateLimit && !app.checkAuthRateLimit(req, reply)) return;
    const { email, password } = req.body;
    if (!email || !password) {
      return reply.view('auth/login.ejs', { user: null, error: 'Email and password are required', title: 'Login', t: req.t, lang: req.lang });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return reply.view('auth/login.ejs', { user: null, error: 'Invalid email or password', title: 'Login', t: req.t, lang: req.lang });
    }
    // Check if user is banned
    if (user.banned) {
      return reply.view('auth/banned.ejs', { user: null, title: 'Account Suspended', reason: user.bannedReason || null, t: req.t, lang: req.lang });
    }
    const token = jwt.sign({ userId: user.id, email: user.email, name: user.name, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
    reply.setCookie('token', token, { path: '/', httpOnly: true, secure: false, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' }); // behind Caddy on HTTP/Tailscale
    return reply.redirect('/');
  });

  app.get('/register', async (req, reply) => {
    if (req.user) return reply.redirect('/');
    return reply.view('auth/register.ejs', { user: null, error: null, title: 'Register', t: req.t, lang: req.lang });
  });

  app.post('/register', async (req, reply) => {
    if (app.checkAuthRateLimit && !app.checkAuthRateLimit(req, reply)) return;
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return reply.view('auth/register.ejs', { user: null, error: 'All fields are required', title: 'Register', t: req.t, lang: req.lang });
    }
    if (!EMAIL_RE.test(email)) {
      return reply.view('auth/register.ejs', { user: null, error: 'Invalid email format', title: 'Register', t: req.t, lang: req.lang });
    }
    if (password.length < 8 || password.length > 1000) {
      return reply.view('auth/register.ejs', { user: null, error: 'Password must be 8-1000 characters', title: 'Register', t: req.t, lang: req.lang });
    }
    if (name.length > 255 || email.length > 255) {
      return reply.view('auth/register.ejs', { user: null, error: 'Input too long', title: 'Register', t: req.t, lang: req.lang });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return reply.view('auth/register.ejs', { user: null, error: 'Email already registered', title: 'Register', t: req.t, lang: req.lang });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email: normalizedEmail, passwordHash, name: name.trim() });
    return reply.redirect('/auth/login?registered=1');
  });

  app.get('/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.redirect('/');
  });
}
