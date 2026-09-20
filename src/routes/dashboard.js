import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { env, getBusiness, businessPassword } from "../config.js";
import * as db from "../db.js";

const router = express.Router();
router.use(express.json({ limit: "10kb" }));

const COOKIE = "business_session";
const cookieOptions = { signed: true, httpOnly: true, sameSite: "lax", secure: env.isProd, maxAge: 12 * 3600_000 };

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireBusiness(req, res, next) {
  const business = getBusiness(req.signedCookies[COOKIE]);
  if (!business) return res.status(401).json({ error: "Sign in to continue." });
  req.business = business;
  next();
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/login", loginLimiter, (req, res) => {
  const body = req.body || {};
  const business = getBusiness(body.business ?? body.clinic);
  const expected = business ? businessPassword(business.id) : "";
  if (!business || !expected || typeof body.password !== "string" || !safeEqual(body.password, expected)) {
    return res.status(401).json({ error: "Business ID or password is incorrect." });
  }
  res.cookie(COOKIE, business.id, cookieOptions);
  res.json({ business: describe(business) });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

/** Everything the dashboard needs to label this industry's leads. */
function describe(business) {
  const pack = business.pack;
  return {
    id: business.id,
    name: business.name,
    timezone: business.timezone,
    vertical: business.vertical,
    jobTypes: pack.jobTypes,
    highValue: pack.highValue,
    contact: pack.contact,
    qualifierLabel: pack.qualifier?.label ?? "",
    qualifierEmpty: pack.qualifier?.empty ?? "",
  };
}

router.get("/me", requireBusiness, (req, res) => {
  res.json({ business: describe(req.business) });
});

router.get("/leads", requireBusiness, (req, res) => {
  res.json({ leads: db.listLeads(req.business.id) });
});

router.get("/conversations/:id", requireBusiness, (req, res) => {
  const conversation = db.getConversation(Number(req.params.id));
  if (!conversation || conversation.business_id !== req.business.id) return res.status(404).json({ error: "Conversation not found." });
  const contact = conversation.channel === "sms" ? conversation.contact : "Website visitor";
  res.json({ channel: conversation.channel, contact, messages: db.getMessages(conversation.id, 200) });
});

const DESK_STATUS = ["new", "contacted", "confirmed", "closed"];
router.patch("/leads/:id", requireBusiness, (req, res) => {
  const { desk_status } = req.body || {};
  if (!DESK_STATUS.includes(desk_status)) return res.status(400).json({ error: "Unknown status." });
  if (!db.updateDeskStatus(Number(req.params.id), req.business.id, desk_status)) return res.status(404).json({ error: "Lead not found." });
  res.json({ ok: true });
});

export default router;
