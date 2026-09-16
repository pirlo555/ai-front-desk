import express from "express";
import twilio from "twilio";
import { env, getClinic } from "../config.js";
import { logSms } from "../db.js";
import { handleMissedCall, handlePatientMessage } from "../conversation.js";

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

// Twilio "A call comes in" webhook. Point the clinic's no-answer forwarding at this number.
router.post("/voice/:clinicId", (req, res) => {
  const clinic = getClinic(req.params.clinicId);
  if (!clinic) return res.status(404).send("Unknown clinic");

  const vr = new twilio.twiml.VoiceResponse();
  vr.say({ language: "en-US" }, `Thanks for calling ${clinic.name}. We're sending you a text message right now so we can help you.`);
  vr.say({ language: "es-MX" }, `Gracias por llamar a ${clinic.name}. Le enviamos un mensaje de texto ahora mismo para ayudarle.`);
  vr.hangup();
  res.type("text/xml").send(vr.toString());

  const caller = String(req.body.From || "");
  if (E164.test(caller)) {
    handleMissedCall({ clinic, callerPhone: caller }).catch((err) => console.error("[voice] missed-call text failed:", err));
  }
});

// Twilio "A message comes in" webhook.
router.post("/sms/:clinicId", (req, res) => {
  const clinic = getClinic(req.params.clinicId);
  if (!clinic) return res.status(404).send("Unknown clinic");

  // Answer Twilio right away; the reply is sent separately once the assistant is done.
  res.type("text/xml").send(new twilio.twiml.MessagingResponse().toString());

  const from = String(req.body.From || "");
  const body = String(req.body.Body || "").slice(0, 1600);
  if (!E164.test(from) || !body.trim()) return;

  logSms({ clinicId: clinic.id, direction: "in", to: clinic.twilioNumber, from, body, status: "received" });
  handlePatientMessage({ clinic, channel: "sms", contact: from, text: body }).catch((err) =>
    console.error("[sms] failed to handle message:", err)
  );
});

export default router;
