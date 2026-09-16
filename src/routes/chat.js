import express from "express";
import rateLimit from "express-rate-limit";
import { env, getClinic } from "../config.js";
import { handlePatientMessage } from "../conversation.js";

const router = express.Router();

function allowedOrigin(clinic, origin) {
  if (!origin) return true; // same-origin requests don't send one
  if (origin === env.publicBaseUrl) return true;
  if (!env.isProd && /^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return clinic.allowedOrigins.includes(origin);
}

function cors(req, res, next) {
  const origin = req.get("Origin");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

router.use(cors);

router.get("/clinics/:clinicId/public", (req, res) => {
  const clinic = getClinic(req.params.clinicId);
  if (!clinic || !allowedOrigin(clinic, req.get("Origin"))) return res.status(404).json({ error: "Clinic not found." });
  res.json({ id: clinic.id, name: clinic.name, phone: clinic.phone, greeting: clinic.greeting.web, color: clinic.color || "#0F6B5C" });
});

const chatLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/chat", chatLimiter, express.json({ limit: "10kb" }), async (req, res) => {
  const { clinic: clinicId, session, message } = req.body || {};
  const clinic = getClinic(clinicId);
  if (!clinic || !allowedOrigin(clinic, req.get("Origin"))) return res.status(404).json({ error: "Clinic not found." });
  if (typeof session !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(session)) {
    return res.status(400).json({ error: "Invalid chat session. Reload the page and try again." });
  }
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return res.status(400).json({ error: "Write a message first." });
  if (text.length > 1000) return res.status(400).json({ error: "Message is too long. Keep it under 1,000 characters." });

  const reply = await handlePatientMessage({ clinic, channel: "web", contact: `web:${session}`, text });
  res.json({ reply });
});

export default router;
