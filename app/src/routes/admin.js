import jwt from 'jsonwebtoken';
import { pool } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const ADMIN_ROLES = ['admin', 'owner'];

// Run migrations on startup (idempotent)
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT`);
    await client.query(`UPDATE users SET role = 'owner' WHERE email = 'admin@stuzzicadenti.ch' AND role = 'user'`);

    // Activity log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_user_id INTEGER REFERENCES users(id),
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

// Auth helper: verify JWT + check admin role via DB
async function requireAdmin(req, reply) {
  const token = req.cookies?.token;
  if (!token) return reply.redirect('/auth/login');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return reply.redirect('/auth/login');
  }

  // Always check role from DB (not JWT) for admin routes
  const { rows } = await pool.query('SELECT id, email, name, role, banned FROM users WHERE id = $1', [payload.userId]);
  if (!rows[0] || rows[0].banned || !ADMIN_ROLES.includes(rows[0].role)) {
    return reply.code(403).send('Forbidden');
  }

  req.adminUser = rows[0];
}

async function logAction(adminId, action, targetUserId, details) {
  await pool.query(
    'INSERT INTO admin_logs (admin_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
    [adminId, action, targetUserId || null, details || null]
  );
}

export default async function adminRoutes(app) {
  // Run migrations when plugin registers
  await runMigrations();

  // All admin routes require admin auth
  app.addHook('preHandler', requireAdmin);

  // Dashboard
  app.get('/', async (req, reply) => {
    const [usersCount, templatesCount, cvsCount, recentUsers, recentCvs] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM templates'),
      pool.query('SELECT COUNT(*) as count FROM cvs'),
      pool.query('SELECT id, email, name, role, banned, created_at FROM users ORDER BY created_at DESC LIMIT 10'),
      pool.query(`
        SELECT c.id, c.title, c.created_at, u.email as user_email
        FROM cvs c JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC LIMIT 10
      `),
    ]);

    return reply.view('admin/dashboard.ejs', {
      user: req.adminUser,
      title: 'Admin Dashboard',
      stats: {
        users: parseInt(usersCount.rows[0].count),
        templates: parseInt(templatesCount.rows[0].count),
        cvs: parseInt(cvsCount.rows[0].count),
      },
      recentUsers: recentUsers.rows,
      recentCvs: recentCvs.rows,
    });
  });

  // Users list
  app.get('/users', async (req, reply) => {
    const search = req.query.search || '';
    let query = 'SELECT id, email, name, role, banned, banned_reason, created_at FROM users';
    const params = [];

    if (search) {
      query += ' WHERE email ILIKE $1 OR name ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);

    return reply.view('admin/users.ejs', {
      user: req.adminUser,
      title: 'Manage Users',
      users: rows,
      search,
    });
  });

  // Change role
  app.post('/users/:id/role', async (req, reply) => {
    const targetId = parseInt(req.params.id, 10);
    const { role } = req.body;
    const validRoles = ['user', 'admin'];

    if (!validRoles.includes(role)) return reply.code(400).send('Invalid role');

    // Only owner can change roles
    if (req.adminUser.role !== 'owner') return reply.code(403).send('Only the owner can change roles');

    // Cannot change own role
    if (targetId === req.adminUser.id) return reply.code(400).send('Cannot change your own role');

    // Cannot change another owner
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [targetId]);
    if (!rows[0]) return reply.code(404).send('User not found');
    if (rows[0].role === 'owner') return reply.code(400).send('Cannot change owner role');

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, targetId]);
    await logAction(req.adminUser.id, 'role_change', targetId, `Changed role to ${role}`);

    return reply.redirect('/admin/users');
  });

  // Ban user
  app.post('/users/:id/ban', async (req, reply) => {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (targetId === req.adminUser.id) return reply.code(400).send('Cannot ban yourself');

    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [targetId]);
    if (!rows[0]) return reply.code(404).send('User not found');
    if (rows[0].role === 'owner') return reply.code(400).send('Cannot ban the owner');

    await pool.query('UPDATE users SET banned = true, banned_reason = $1 WHERE id = $2', [reason || 'No reason provided', targetId]);
    await logAction(req.adminUser.id, 'ban', targetId, reason || 'No reason provided');

    return reply.redirect('/admin/users');
  });

  // Unban user
  app.post('/users/:id/unban', async (req, reply) => {
    const targetId = parseInt(req.params.id, 10);

    await pool.query('UPDATE users SET banned = false, banned_reason = NULL WHERE id = $1', [targetId]);
    await logAction(req.adminUser.id, 'unban', targetId, null);

    return reply.redirect('/admin/users');
  });

  // Templates management
  app.get('/templates', async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');

    // Count CVs per template
    const usage = await pool.query(`
      SELECT template_id, COUNT(*) as count
      FROM cvs WHERE template_id IS NOT NULL
      GROUP BY template_id
    `);
    const usageMap = {};
    for (const row of usage.rows) {
      usageMap[row.template_id] = parseInt(row.count);
    }

    return reply.view('admin/templates.ejs', {
      user: req.adminUser,
      title: 'Manage Templates',
      templates: rows,
      usageMap,
    });
  });

  // Activity log
  app.get('/logs', async (req, reply) => {
    const { rows } = await pool.query(`
      SELECT l.*, a.email as admin_email, t.email as target_email
      FROM admin_logs l
      LEFT JOIN users a ON l.admin_id = a.id
      LEFT JOIN users t ON l.target_user_id = t.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);

    return reply.view('admin/logs.ejs', {
      user: req.adminUser,
      title: 'Activity Log',
      logs: rows,
    });
  });
}
