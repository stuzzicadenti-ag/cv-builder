import { pool, db } from './index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running migrations...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      typst_template TEXT NOT NULL,
      preview_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cvs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      template_id INTEGER REFERENCES templates(id),
      title VARCHAR(255) NOT NULL DEFAULT 'My CV',
      data JSONB NOT NULL DEFAULT '{}',
      pdf_path VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cvs_template_id ON cvs(template_id)`);

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
