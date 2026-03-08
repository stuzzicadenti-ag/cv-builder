import { pgTable, serial, text, varchar, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(), // unique() creates an index for login lookups
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('user'),
  banned: boolean('banned').default(false),
  bannedReason: text('banned_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  typstTemplate: text('typst_template').notNull(),
  previewUrl: varchar('preview_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cvs = pgTable('cvs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  templateId: integer('template_id').references(() => templates.id),
  title: varchar('title', { length: 255 }).notNull().default('My CV'),
  data: jsonb('data').notNull().default({}),
  pdfPath: varchar('pdf_path', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('cvs_user_id_idx').on(table.userId),
  index('cvs_template_id_idx').on(table.templateId),
]);
