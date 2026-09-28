/**
 * MySQL backend, used in production. It lives outside the application's
 * filesystem, so deploys and container restarts no longer destroy the data.
 *
 * Differences from the local file that the schema has to account for:
 * MySQL needs a length on any indexed string column, so the columns that take
 * part in a key are VARCHAR rather than TEXT; AUTO_INCREMENT replaces
 * AUTOINCREMENT; and utf8mb4 is set explicitly so Spanish accents and emoji in
 * a customer's message survive the round trip.
 */
import mysql from "mysql2/promise";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id VARCHAR(64) NOT NULL,
    channel VARCHAR(8) NOT NULL,
    contact VARCHAR(191) NOT NULL,
    opted_out TINYINT NOT NULL DEFAULT 0,
    escalation_notified TINYINT NOT NULL DEFAULT 0,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    UNIQUE KEY uniq_conversation (business_id, channel, contact)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    KEY idx_messages_conv (conversation_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL UNIQUE,
    business_id VARCHAR(64) NOT NULL,
    name VARCHAR(191) NOT NULL DEFAULT '',
    phone VARCHAR(48) NOT NULL DEFAULT '',
    language VARCHAR(8) NOT NULL DEFAULT 'en',
    job_type VARCHAR(48) NOT NULL DEFAULT 'other',
    qualifier VARCHAR(191) NOT NULL DEFAULT '',
    urgency VARCHAR(16) NOT NULL DEFAULT 'routine',
    status VARCHAR(16) NOT NULL DEFAULT 'followup',
    preferred_time VARCHAR(191) NOT NULL DEFAULT '',
    summary VARCHAR(255) NOT NULL DEFAULT '',
    desk_status VARCHAR(16) NOT NULL DEFAULT 'new',
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    KEY idx_leads_business (business_id, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS sms_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    to_number VARCHAR(48) NOT NULL,
    from_number VARCHAR(48) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(48) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    KEY idx_sms_business (business_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function open(cfg) {
  const pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4_unicode_ci",
  });

  // Fail loudly at startup rather than on a customer's first message.
  try {
    const conn = await pool.getConnection();
    conn.release();
  } catch (err) {
    throw new Error(
      `Could not reach the MySQL database at ${cfg.host}:${cfg.port} as "${cfg.user}". ` +
        `Check MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD and MYSQL_DATABASE. (${err.code || err.message})`
    );
  }

  for (const stmt of SCHEMA) await pool.query(stmt);

  return {
    name: `mysql (${cfg.database} at ${cfg.host})`,
    async all(sql, params = []) {
      // query, not execute: the server-side prepared protocol rejects a
      // placeholder in LIMIT, which several of these statements use.
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async run(sql, params = []) {
      const [res] = await pool.query(sql, params);
      return { insertId: Number(res.insertId || 0), affectedRows: Number(res.affectedRows || 0) };
    },
  };
}
