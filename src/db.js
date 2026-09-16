import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ROOT } from "./config.js";

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
const db = new DatabaseSync(path.join(ROOT, "data", "app.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('web', 'sms')),
    contact TEXT NOT NULL,
    opted_out INTEGER NOT NULL DEFAULT 0,
    escalation_notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (clinic_id, channel, contact)
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
    clinic_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    treatment TEXT NOT NULL DEFAULT 'other',
    insurance TEXT NOT NULL DEFAULT '',
    urgency TEXT NOT NULL DEFAULT 'routine',
    status TEXT NOT NULL DEFAULT 'followup',
    preferred_time TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    desk_status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leads_clinic ON leads(clinic_id, updated_at);

  CREATE TABLE IF NOT EXISTS sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    to_number TEXT NOT NULL,
    from_number TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();

export function getOrCreateConversation(clinicId, channel, contact) {
  const found = db
    .prepare("SELECT * FROM conversations WHERE clinic_id = ? AND channel = ? AND contact = ?")
    .get(clinicId, channel, contact);
  if (found) return found;
  const t = now();
  const { lastInsertRowid } = db
    .prepare("INSERT INTO conversations (clinic_id, channel, contact, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(clinicId, channel, contact, t, t);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(lastInsertRowid);
}

export function getConversation(id) {
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) || null;
}

export function setOptedOut(conversationId, optedOut) {
  db.prepare("UPDATE conversations SET opted_out = ?, updated_at = ? WHERE id = ?").run(optedOut ? 1 : 0, now(), conversationId);
}

export function markEscalationNotified(conversationId) {
  db.prepare("UPDATE conversations SET escalation_notified = 1 WHERE id = ?").run(conversationId);
}

export function addMessage(conversationId, role, content) {
  const t = now();
  db.prepare("INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)").run(conversationId, role, content, t);
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(t, conversationId);
}

export function getMessages(conversationId, limit = 60) {
  return db
    .prepare("SELECT role, content, created_at FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC")
    .all(conversationId, limit);
}

export function countUserMessages(conversationId) {
  return db.prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND role = 'user'").get(conversationId).n;
}

const LEAD_FIELDS = ["name", "phone", "language", "treatment", "insurance", "urgency", "status", "preferred_time", "summary"];

/** Creates or updates the lead for a conversation. Returns { lead, isNew, statusChanged }. */
export function upsertLead(conversationId, clinicId, data) {
  const existing = db.prepare("SELECT * FROM leads WHERE conversation_id = ?").get(conversationId);
  const t = now();
  if (!existing) {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO leads (conversation_id, clinic_id, ${LEAD_FIELDS.join(", ")}, created_at, updated_at)
         VALUES (?, ?, ${LEAD_FIELDS.map(() => "?").join(", ")}, ?, ?)`
      )
      .run(conversationId, clinicId, ...LEAD_FIELDS.map((f) => data[f] ?? ""), t, t);
    return { lead: getLead(lastInsertRowid), isNew: true, statusChanged: true };
  }
  // Keep known values when the model sends an empty field.
  const merged = Object.fromEntries(LEAD_FIELDS.map((f) => [f, data[f] || existing[f]]));
  db.prepare(`UPDATE leads SET ${LEAD_FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(
    ...LEAD_FIELDS.map((f) => merged[f]),
    t,
    existing.id
  );
  return { lead: getLead(existing.id), isNew: false, statusChanged: merged.status !== existing.status };
}

export function getLead(id) {
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id) || null;
}

export function listLeads(clinicId, limit = 200) {
  return db
    .prepare(
      `SELECT l.*, c.channel,
         (SELECT content FROM messages m WHERE m.conversation_id = l.conversation_id ORDER BY m.id DESC LIMIT 1) AS last_message
       FROM leads l JOIN conversations c ON c.id = l.conversation_id
       WHERE l.clinic_id = ? ORDER BY l.updated_at DESC LIMIT ?`
    )
    .all(clinicId, limit);
}

export function updateDeskStatus(leadId, clinicId, deskStatus) {
  const { changes } = db
    .prepare("UPDATE leads SET desk_status = ?, updated_at = ? WHERE id = ? AND clinic_id = ?")
    .run(deskStatus, now(), leadId, clinicId);
  return changes > 0;
}

export function logSms({ clinicId, direction, to, from, body, status }) {
  db.prepare("INSERT INTO sms_log (clinic_id, direction, to_number, from_number, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    clinicId,
    direction,
    to,
    from,
    body,
    status,
    now()
  );
}

export function listSms(clinicId, number, limit = 50) {
  return db
    .prepare(
      `SELECT * FROM (SELECT * FROM sms_log WHERE clinic_id = ? AND (to_number = ? OR from_number = ?) ORDER BY id DESC LIMIT ?) ORDER BY id ASC`
    )
    .all(clinicId, number, number, limit);
}
