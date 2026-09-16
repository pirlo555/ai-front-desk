import express from "express";
import { getClinic } from "../config.js";
import { listSms, logSms } from "../db.js";
import { handleMissedCall, handlePatientMessage } from "../conversation.js";

// Only mounted when MOCK_SMS is on: lets you test SMS flows without Twilio.
const router = express.Router();
router.use(express.json({ limit: "10kb" }));

const PHONE = /^\+1\d{10}$/;

function parse(req, res) {
  const clinic = getClinic(req.body?.clinic ?? req.query.clinic);
  const phone = String(req.body?.phone ?? req.query.phone ?? "");
  if (!clinic) return res.status(404).json({ error: "Unknown clinic." }), null;
  if (!PHONE.test(phone)) return res.status(400).json({ error: "Use a US number like +18325550177." }), null;
  return { clinic, phone };
}

router.post("/missed-call", async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  await handleMissedCall({ clinic: p.clinic, callerPhone: p.phone });
  res.json({ ok: true });
});

router.post("/sms", async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  const text = String(req.body.text || "").trim().slice(0, 1600);
  if (!text) return res.status(400).json({ error: "Write a message first." });
  logSms({ clinicId: p.clinic.id, direction: "in", to: p.clinic.twilioNumber || "clinic", from: p.phone, body: text, status: "mock" });
  await handlePatientMessage({ clinic: p.clinic, channel: "sms", contact: p.phone, text });
  res.json({ ok: true });
});

router.get("/sms", (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  res.json({
    patient: listSms(p.clinic.id, p.phone),
    frontDesk: p.clinic.frontDeskPhone ? listSms(p.clinic.id, p.clinic.frontDeskPhone) : [],
  });
});

export default router;
