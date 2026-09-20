import express from "express";
import rateLimit from "express-rate-limit";
import { env, getBusiness } from "../config.js";
import { handleIncomingMessage } from "../conversation.js";

const router = express.Router();

/**
 * The origin check exists to stop other websites embedding a business's chat.
 * A request coming from a page this same server served is never that, so it is
 * always allowed: without this the widget breaks behind a tunnel or any
 * hostname other than PUBLIC_BASE_URL, which is exactly the demo setup.
 */
function allowedOrigin(business, req) {
  const origin = req.get("Origin");
  if (!origin) return true; // same-origin requests don't send one
  if (origin === env.publicBaseUrl) return true;
  try {
    if (new URL(origin).host === req.get("Host")) return true;
  } catch {
    return false; // unparseable Origin header
  }
  if (!env.isProd && /^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return business.allowedOrigins.includes(origin);
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

router.get("/businesses/:businessId/public", (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business || !allowedOrigin(business, req)) return res.status(404).json({ error: "Business not found." });
  res.json({
    id: business.id,
    name: business.name,
    phone: business.phone,
    greeting: business.greeting.web,
    color: business.color,
  });
});

const chatLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/chat", chatLimiter, express.json({ limit: "10kb" }), async (req, res) => {
  const body = req.body || {};
  const business = getBusiness(body.business ?? body.clinic);
  if (!business || !allowedOrigin(business, req)) return res.status(404).json({ error: "Business not found." });
  if (typeof body.session !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(body.session)) {
    return res.status(400).json({ error: "Invalid chat session. Reload the page and try again." });
  }
  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) return res.status(400).json({ error: "Write a message first." });
  if (text.length > 1000) return res.status(400).json({ error: "Message is too long. Keep it under 1,000 characters." });

  const reply = await handleIncomingMessage({ business, channel: "web", contact: `web:${body.session}`, text });
  res.json({ reply });
});

export default router;
