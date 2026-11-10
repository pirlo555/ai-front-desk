import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { env, getBusiness, businessPassword } from "../config.js";
import { jobTypeLabels, pick } from "../verticals.js";
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

/**
 * Everything the dashboard needs to label this industry's leads, already
 * resolved into the staff language chosen in the business file.
 */
function describe(business) {
  const pack = business.pack;
  const lang = business.language;
  return {
    id: business.id,
    name: business.name,
    timezone: business.timezone,
    vertical: business.vertical,
    language: lang,
    jobTypes: jobTypeLabels(pack, lang),
    highValue: pack.highValue,
    contact: { one: pick(pack.contact.one, lang), plural: pick(pack.contact.plural, lang) },
    qualifierLabel: pack.qualifier ? pick(pack.qualifier.label, lang) : "",
    qualifierEmpty: pack.qualifier ? pick(pack.qualifier.empty, lang) : "",
  };
}

router.get("/me", requireBusiness, (req, res) => {
  res.json({ business: describe(req.business) });
});

router.get("/leads", requireBusiness, async (req, res) => {
  const leads = await db.listLeads(req.business.id);
  // A missed-call lead always has a number to call back: the one that texted in.
  // The model only fills lead.phone when the caller spells it out, so fall back
  // to the conversation's own contact instead of showing "no phone yet". Web
  // sessions are deliberately left out: their contact is a session id.
  for (const lead of leads) {
    if (!lead.phone && lead.channel === "sms") lead.phone = lead.conversation_contact;
    delete lead.conversation_contact;
  }
  res.json({ leads });
});

router.get("/conversations/:id", requireBusiness, async (req, res) => {
  const conversation = await db.getConversation(Number(req.params.id));
  if (!conversation || conversation.business_id !== req.business.id) return res.status(404).json({ error: "Conversation not found." });
  const webVisitor = req.business.language === "es" ? "Visitante de la web" : "Website visitor";
  const contact = conversation.channel === "sms" ? conversation.contact : webVisitor;
  res.json({ channel: conversation.channel, contact, messages: await db.getMessages(conversation.id, 200) });
});

const DESK_STATUS = ["new", "contacted", "confirmed", "closed"];
router.patch("/leads/:id", requireBusiness, async (req, res) => {
  const { desk_status } = req.body || {};
  if (!DESK_STATUS.includes(desk_status)) return res.status(400).json({ error: "Unknown status." });
  if (!(await db.updateDeskStatus(Number(req.params.id), req.business.id, desk_status))) return res.status(404).json({ error: "Lead not found." });
  res.json({ ok: true });
});

export default router;
