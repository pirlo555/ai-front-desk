import express from "express";
import twilio from "twilio";
import { env, getBusiness } from "../config.js";
import { logSms } from "../db.js";
import { handleMissedCall, handleIncomingMessage } from "../conversation.js";

const router = express.Router();
router.use(express.urlencoded({ extended: false, limit: "20kb" }));

// Rejects requests that were not signed by Twilio.
router.use((req, res, next) => {
  if (env.mockSms) return next();
  const signature = req.get("X-Twilio-Signature") || "";
  const url = env.publicBaseUrl + req.originalUrl;
  if (!twilio.validateRequest(env.twilioAuthToken, signature, url, req.body)) {
    return res.status(403).send("Invalid Twilio signature");
  }
  next();
});

const E164 = /^\+[1-9]\d{7,14}$/;

// Twilio "A call comes in" webhook. Point the business's no-answer forwarding at this number.
router.post("/voice/:businessId", (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).send("Unknown business");

  const vr = new twilio.twiml.VoiceResponse();
  vr.say({ language: "en-US" }, `Thanks for calling ${business.name}. We're sending you a text message right now so we can help you.`);
  vr.say({ language: "es-MX" }, `Gracias por llamar a ${business.name}. Le enviamos un mensaje de texto ahora mismo para ayudarle.`);
  vr.hangup();
  res.type("text/xml").send(vr.toString());

  const caller = String(req.body.From || "");
  if (E164.test(caller)) {
    handleMissedCall({ business, callerPhone: caller }).catch((err) => console.error("[voice] missed-call text failed:", err));
  }
});

// Twilio "A message comes in" webhook.
router.post("/sms/:businessId", (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).send("Unknown business");

  // Answer Twilio right away; the reply is sent separately once the assistant is done.
  res.type("text/xml").send(new twilio.twiml.MessagingResponse().toString());

  const from = String(req.body.From || "");
  const body = String(req.body.Body || "").slice(0, 1600);
  if (!E164.test(from) || !body.trim()) return;

  logSms({ businessId: business.id, direction: "in", to: business.twilioNumber, from, body, status: "received" }).catch((err) =>
    console.error("[sms] could not log the inbound message:", err)
  );
  handleIncomingMessage({ business, channel: "sms", contact: from, text: body }).catch((err) =>
    console.error("[sms] failed to handle message:", err)
  );
});

export default router;
