import express from "express";
import { getBusiness, businesses } from "../config.js";
import { listSms, logSms } from "../db.js";
import { handleMissedCall, handleIncomingMessage } from "../conversation.js";

// Only mounted when MOCK_SMS is on: lets you test SMS flows without Twilio.
const router = express.Router();
router.use(express.json({ limit: "10kb" }));

const PHONE = /^\+1\d{10}$/;

// Fills the simulator's business picker.
router.get("/businesses", (req, res) => {
  res.json({
    businesses: [...businesses.values()].map((b) => ({ id: b.id, name: b.name, vertical: b.pack.label })),
  });
});

function parse(req, res) {
  const business = getBusiness(req.body?.business ?? req.query.business);
  const phone = String(req.body?.phone ?? req.query.phone ?? "");
  if (!business) return res.status(404).json({ error: "Unknown business." }), null;
  if (!PHONE.test(phone)) return res.status(400).json({ error: "Use a US number like +18325550177." }), null;
  return { business, phone };
}

router.post("/missed-call", async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  await handleMissedCall({ business: p.business, callerPhone: p.phone });
  res.json({ ok: true });
});

router.post("/sms", async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  const text = String(req.body.text || "").trim().slice(0, 1600);
  if (!text) return res.status(400).json({ error: "Write a message first." });
  logSms({ businessId: p.business.id, direction: "in", to: p.business.twilioNumber || "business", from: p.phone, body: text, status: "mock" });
  await handleIncomingMessage({ business: p.business, channel: "sms", contact: p.phone, text });
  res.json({ ok: true });
});

router.get("/sms", (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  res.json({
    contact: listSms(p.business.id, p.phone),
    frontDesk: p.business.frontDeskPhone ? listSms(p.business.id, p.business.frontDeskPhone) : [],
  });
});

export default router;
