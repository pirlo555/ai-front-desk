/**
 * Local file database. This is the development backend: it needs nothing
 * installed and keeps `npm run dev` a single command. It is NOT used in
 * production, where the host wipes the filesystem on every deploy.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ROOT } from "./config.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('web', 'sms')),
    contact TEXT NOT NULL,
    opted_out INTEGER NOT NULL DEFAULT 0,
    escalation_notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (business_id, channel, contact)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL UNIQUE REFERENCES conversations(id),
    business_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    job_type TEXT NOT NULL DEFAULT 'other',
    qualifier TEXT NOT NULL DEFAULT '',
    urgency TEXT NOT NULL DEFAULT 'routine',
    status TEXT NOT NULL DEFAULT 'followup',
    preferred_time TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    desk_status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leads_business ON leads(business_id, updated_at);

  CREATE TABLE IF NOT EXISTS sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    to_number TEXT NOT NULL,
    from_number TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

/**
 * Renames the dental-only columns from the first version. Only local files
 * carry that history, so it lives here rather than in the shared module.
 */
function migrateFromDentalSchema(db) {
  const tableExists = (name) =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) != null;
  const hasColumn = (table, column) =>
    db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);

  const renames = [
    ["conversations", "clinic_id", "business_id"],
    ["leads", "clinic_id", "business_id"],
    ["leads", "treatment", "job_type"],
    ["leads", "insurance", "qualifier"],
    ["sms_log", "clinic_id", "business_id"],
  ];
  for (const [table, from, to] of renames) {
    if (tableExists(table) && hasColumn(table, from) && !hasColumn(table, to)) {
      db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
      console.log(`[db] migrated ${table}.${from} -> ${to}`);
    }
  }
}

export async function open() {
  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  const db = new DatabaseSync(path.join(ROOT, "data", "app.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrateFromDentalSchema(db);
  db.exec(SCHEMA);

  return {
    name: "file (data/app.db)",
    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const r = db.prepare(sql).run(...params);
      return { insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) };
    },
  };
}
