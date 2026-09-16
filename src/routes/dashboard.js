import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { env, getClinic, clinicPassword } from "../config.js";
import * as db from "../db.js";

const router = express.Router();
router.use(express.json({ limit: "10kb" }));

const COOKIE = "clinic_session";
const cookieOptions = { signed: true, httpOnly: true, sameSite: "lax", secure: env.isProd, maxAge: 12 * 3600_000 };

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireClinic(req, res, next) {
  const clinic = getClinic(req.signedCookies[COOKIE]);
  if (!clinic) return res.status(401).json({ error: "Sign in to continue." });
  req.clinic = clinic;
  next();
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/login", loginLimiter, (req, res) => {
  const { clinic: clinicId, password } = req.body || {};
  const clinic = getClinic(clinicId);
  const expected = clinic ? clinicPassword(clinic.id) : "";
  if (!clinic || !expected || typeof password !== "string" || !safeEqual(password, expected)) {
    return res.status(401).json({ error: "Clinic ID or password is incorrect." });
  }
  res.cookie(COOKIE, clinic.id, cookieOptions);
  res.json({ clinic: { id: clinic.id, name: clinic.name } });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

router.get("/me", requireClinic, (req, res) => {
  res.json({ clinic: { id: req.clinic.id, name: req.clinic.name, timezone: req.clinic.timezone } });
});

router.get("/leads", requireClinic, (req, res) => {
  res.json({ leads: db.listLeads(req.clinic.id) });
});

router.get("/conversations/:id", requireClinic, (req, res) => {
  const conversation = db.getConversation(Number(req.params.id));
  if (!conversation || conversation.clinic_id !== req.clinic.id) return res.status(404).json({ error: "Conversation not found." });
  const contact = conversation.channel === "sms" ? conversation.contact : "Website visitor";
  res.json({ channel: conversation.channel, contact, messages: db.getMessages(conversation.id, 200) });
});

const DESK_STATUS = ["new", "contacted", "confirmed", "closed"];
router.patch("/leads/:id", requireClinic, (req, res) => {
  const { desk_status } = req.body || {};
  if (!DESK_STATUS.includes(desk_status)) return res.status(400).json({ error: "Unknown status." });
  if (!db.updateDeskStatus(Number(req.params.id), req.clinic.id, desk_status)) return res.status(404).json({ error: "Lead not found." });
  res.json({ ok: true });
});

export default router;
