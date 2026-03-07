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
  // Auth middleware (decorates all requests)
  app.decorateRequest('user', null);
  app.addHook('preHandler', async (req) => {
    const token = req.cookies?.token;
    if (!token) return;
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const [user] = await db.select({ id: users.id, email: users.email, name: users.name })
        .from(users).where(eq(users.id, payload.userId)).limit(1);
      req.user = user || null;
    } catch { req.user = null; }
  });

  app.get('/login', async (req, reply) => {
    if (req.user) return reply.redirect('/');
    return reply.view('auth/login.ejs', { error: null, title: 'Login' });
  });

  app.post('/login', async (req, reply) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return reply.view('auth/login.ejs', { error: 'Email and password are required', title: 'Login' });
    }
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return reply.view('auth/login.ejs', { error: 'Invalid email or password', title: 'Login' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    reply.setCookie('token', token, { path: '/', httpOnly: true, secure: IS_PROD, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' });
    return reply.redirect('/');
  });

  app.get('/register', async (req, reply) => {
    if (req.user) return reply.redirect('/');
    return reply.view('auth/register.ejs', { error: null, title: 'Register' });
  });

  app.post('/register', async (req, reply) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return reply.view('auth/register.ejs', { error: 'All fields are required', title: 'Register' });
    }
    if (!EMAIL_RE.test(email)) {
      return reply.view('auth/register.ejs', { error: 'Invalid email format', title: 'Register' });
    }
    if (password.length < 8) {
      return reply.view('auth/register.ejs', { error: 'Password must be at least 8 characters', title: 'Register' });
    }
    if (name.length > 255 || email.length > 255) {
      return reply.view('auth/register.ejs', { error: 'Input too long', title: 'Register' });
    }
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.view('auth/register.ejs', { error: 'Email already registered', title: 'Register' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, passwordHash, name });
    return reply.redirect('/auth/login');
  });

  app.get('/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.redirect('/');
  });
}
