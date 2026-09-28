/**
 * Data access. Every function is async because production runs on MySQL; the
 * local file backend simply resolves immediately. Which backend is used is
 * decided by env.mysql, see config.js.
 */
import { env } from "./config.js";
import { open as openSqlite } from "./db-sqlite.js";
import { open as openMysql } from "./db-mysql.js";

/**
 * The connection is opened lazily instead of with a top-level await.
 * Hostinger's LiteSpeed runner loads the app through require(), which refuses
 * any ESM graph containing top-level await, so the app crashed on boot with
 * ERR_REQUIRE_ASYNC_MODULE. Keeping the module synchronous at import time
 * avoids that; server.js still calls initDb() before listening, so bad
 * credentials are still caught at startup rather than mid-conversation.
 */
let opening = null;

function driver() {
  opening ??= (env.mysql ? openMysql(env.mysql) : openSqlite()).then((d) => {
    console.log(`[db] using ${d.name}`);
    return d;
  });
  return opening;
}

/** Opens the connection and creates the tables. Call once, before serving. */
export async function initDb() {
  await driver();
}

const db = {
  async all(sql, params) {
    return (await driver()).all(sql, params);
  },
  async run(sql, params) {
    return (await driver()).run(sql, params);
  },
};

const now = () => new Date().toISOString();

/** Row limits are inlined rather than bound, so they are clamped here. */
const cap = (n, max) => Math.min(Math.max(parseInt(n, 10) || 0, 1), max);

async function one(sql, params) {
  const rows = await db.all(sql, params);
  return rows[0] ?? null;
}

export async function getOrCreateConversation(businessId, channel, contact) {
  const found = await one(
    "SELECT * FROM conversations WHERE business_id = ? AND channel = ? AND contact = ?",
    [businessId, channel, contact]
  );
  if (found) return found;
  const t = now();
  const { insertId } = await db.run(
    "INSERT INTO conversations (business_id, channel, contact, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [businessId, channel, contact, t, t]
  );
  return one("SELECT * FROM conversations WHERE id = ?", [insertId]);
}

export async function getConversation(id) {
  return one("SELECT * FROM conversations WHERE id = ?", [id]);
}

export async function setOptedOut(conversationId, optedOut) {
  await db.run("UPDATE conversations SET opted_out = ?, updated_at = ? WHERE id = ?", [
    optedOut ? 1 : 0,
    now(),
    conversationId,
  ]);
}

export async function markEscalationNotified(conversationId) {
  await db.run("UPDATE conversations SET escalation_notified = 1 WHERE id = ?", [conversationId]);
}

export async function addMessage(conversationId, role, content) {
  const t = now();
  await db.run("INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)", [
    conversationId,
    role,
    content,
    t,
  ]);
  await db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [t, conversationId]);
}

/** The newest `limit` messages, returned oldest first so they read as a thread. */
export async function getMessages(conversationId, limit = 60) {
  return db.all(
    `SELECT role, content, created_at FROM (
       SELECT id, role, content, created_at FROM messages
       WHERE conversation_id = ? ORDER BY id DESC LIMIT ${cap(limit, 500)}
     ) AS recent ORDER BY id ASC`,
    [conversationId]
  );
}

export async function countUserMessages(conversationId) {
  const row = await one("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND role = 'user'", [
    conversationId,
  ]);
  return Number(row?.n ?? 0);
}

const LEAD_FIELDS = ["name", "phone", "language", "job_type", "qualifier", "urgency", "status", "preferred_time", "summary"];

/** Creates or updates the lead for a conversation. Returns { lead, isNew, statusChanged }. */
export async function upsertLead(conversationId, businessId, data) {
  const existing = await one("SELECT * FROM leads WHERE conversation_id = ?", [conversationId]);
  const t = now();
  if (!existing) {
    const { insertId } = await db.run(
      `INSERT INTO leads (conversation_id, business_id, ${LEAD_FIELDS.join(", ")}, created_at, updated_at)
       VALUES (?, ?, ${LEAD_FIELDS.map(() => "?").join(", ")}, ?, ?)`,
      [conversationId, businessId, ...LEAD_FIELDS.map((f) => data[f] ?? ""), t, t]
    );
    return { lead: await getLead(insertId), isNew: true, statusChanged: true };
  }
  // Keep known values when the model sends an empty field.
  const merged = Object.fromEntries(LEAD_FIELDS.map((f) => [f, data[f] || existing[f]]));
  await db.run(`UPDATE leads SET ${LEAD_FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, [
    ...LEAD_FIELDS.map((f) => merged[f]),
    t,
    existing.id,
  ]);
  return { lead: await getLead(existing.id), isNew: false, statusChanged: merged.status !== existing.status };
}

export async function getLead(id) {
  return one("SELECT * FROM leads WHERE id = ?", [id]);
}

export async function listLeads(businessId, limit = 200) {
  return db.all(
    `SELECT l.*, c.channel,
       (SELECT content FROM messages m WHERE m.conversation_id = l.conversation_id ORDER BY m.id DESC LIMIT 1) AS last_message
     FROM leads l JOIN conversations c ON c.id = l.conversation_id
     WHERE l.business_id = ? ORDER BY l.updated_at DESC LIMIT ${cap(limit, 1000)}`,
    [businessId]
  );
}

export async function updateDeskStatus(leadId, businessId, deskStatus) {
  const { affectedRows } = await db.run(
    "UPDATE leads SET desk_status = ?, updated_at = ? WHERE id = ? AND business_id = ?",
    [deskStatus, now(), leadId, businessId]
  );
  return affectedRows > 0;
}

export async function logSms({ businessId, direction, to, from, body, status }) {
  await db.run(
    "INSERT INTO sms_log (business_id, direction, to_number, from_number, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [businessId, direction, to, from, body, status, now()]
  );
}

export async function listSms(businessId, number, limit = 50) {
  return db.all(
    `SELECT * FROM (
       SELECT * FROM sms_log WHERE business_id = ? AND (to_number = ? OR from_number = ?)
       ORDER BY id DESC LIMIT ${cap(limit, 500)}
     ) AS recent ORDER BY id ASC`,
    [businessId, number, number]
  );
}
