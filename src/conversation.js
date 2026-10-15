import { env } from "./config.js";
import * as db from "./db.js";
import { runAgent, fallbackResult } from "./agent.js";
import { sendSms } from "./messaging.js";
import { pick } from "./verticals.js";

const MAX_USER_MESSAGES = 40;
const OPT_OUT = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|parar|detener|baja)\s*$/i;
const OPT_IN = /^\s*(start|unstop|yes)\s*$/i;
// US carriers require a HELP reply for any A2P campaign, and the campaign
// registration asks for its exact wording. It must identify the sender and
// repeat how to opt out, so it is built from the business rather than the model.
const OPT_HELP = /^\s*(help|info|ayuda|informacion|información)\s*$/i;

function helpReply(business) {
  return (
    `${business.name}: we text back missed calls and help you book. ` +
    `Call us at ${business.phone}. Reply STOP to opt out. / ` +
    `Contestamos las llamadas perdidas y le ayudamos a agendar. ` +
    `Llámenos al ${business.phone}. Responda STOP para no recibir más mensajes.`
  );
}

// One turn at a time per conversation, so replies never cross.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

// Alerts are read by the business's own staff, so they follow the language set
// in its file -- not the language the member of the public happened to write in.
const ALERTS = {
  en: {
    open: "Open",
    newLead: (urgent, who, job) => `new ${urgent ? "URGENT " : ""}${who} lead (${job}).`,
    appointment: (job) => `appointment request to confirm (${job}).`,
    needsPerson: "a conversation needs a person.",
    fallbackJob: "New request",
  },
  es: {
    open: "Abre",
    newLead: (urgent, who, job) => `nuevo contacto${urgent ? " URGENTE" : ""} de ${who} (${job}).`,
    appointment: (job) => `petición de cita por confirmar (${job}).`,
    needsPerson: "una conversación necesita a una persona.",
    fallbackJob: "Petición nueva",
  },
};

async function notifyFrontDesk(business, text) {
  if (!business.frontDeskPhone) return;
  const t = ALERTS[business.language] || ALERTS.en;
  // Keep personal details out of the SMS; staff read them in the dashboard.
  await sendSms(business, business.frontDeskPhone, `${business.name}: ${text} ${t.open} ${env.publicBaseUrl}/dashboard`);
}

async function afterTurn(business, conversation, result) {
  const lang = business.language;
  const t = ALERTS[lang] || ALERTS.en;
  if (result.lead) {
    const { lead, isNew, statusChanged } = await db.upsertLead(conversation.id, business.id, result.lead);
    const job = pick(business.pack.jobTypes[lead.job_type], lang) || t.fallbackJob;
    const who = pick(business.pack.contact.one, lang);
    if (isNew) {
      await notifyFrontDesk(business, t.newLead(lead.urgency === "emergency", who, job));
    } else if (statusChanged && lead.status === "requested") {
      await notifyFrontDesk(business, t.appointment(job));
    }
  }
  if (result.escalate && !conversation.escalation_notified) {
    await db.markEscalationNotified(conversation.id);
    await notifyFrontDesk(business, t.needsPerson);
  }
}

/**
 * Handles one incoming message on any channel and returns the assistant reply
 * (or null when nothing should be sent back).
 */
export async function handleIncomingMessage({ business, channel, contact, text }) {
  const conversation = await db.getOrCreateConversation(business.id, channel, contact);

  if (channel === "sms") {
    if (OPT_OUT.test(text)) {
      await db.setOptedOut(conversation.id, true);
      return null; // Twilio sends the carrier-required opt-out confirmation.
    }
    if (OPT_IN.test(text) && conversation.opted_out) {
      await db.setOptedOut(conversation.id, false);
      return null;
    }
    // HELP is answered even after an opt-out: the rules require it to keep
    // working, and it is the only way back for someone who stopped by mistake.
    if (OPT_HELP.test(text)) {
      const reply = helpReply(business);
      await db.addMessage(conversation.id, "user", text);
      await db.addMessage(conversation.id, "assistant", reply);
      await sendSms(business, contact, reply);
      return reply;
    }
    if (conversation.opted_out) return null;
  }

  await db.addMessage(conversation.id, "user", text);

  return withLock(conversation.id, async () => {
    const fresh = await db.getConversation(conversation.id);
    const messages = await db.getMessages(fresh.id);
    if (messages[messages.length - 1]?.role !== "user") return null; // already answered in an earlier turn

    let result;
    if ((await db.countUserMessages(fresh.id)) > MAX_USER_MESSAGES) {
      result = fallbackResult();
    } else {
      try {
        result = await runAgent({ business, channel, messages });
      } catch (err) {
        console.error("[agent] request failed:", err?.status ?? "", err?.message ?? err);
        result = fallbackResult();
      }
    }

    await db.addMessage(fresh.id, "assistant", result.reply);
    if (channel === "sms") await sendSms(business, contact, result.reply);
    await afterTurn(business, fresh, result);
    return result.reply;
  });
}

/** A call to the business went unanswered: text the caller first. */
export async function handleMissedCall({ business, callerPhone }) {
  const conversation = await db.getOrCreateConversation(business.id, "sms", callerPhone);
  if (conversation.opted_out) return;
  const greeting = business.greeting.sms;
  await db.addMessage(conversation.id, "assistant", greeting);
  await sendSms(business, callerPhone, greeting);
}
