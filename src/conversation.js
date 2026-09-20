import { env } from "./config.js";
import * as db from "./db.js";
import { runAgent, fallbackResult } from "./agent.js";
import { sendSms } from "./messaging.js";

const MAX_USER_MESSAGES = 40;
const OPT_OUT = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|parar|detener|baja)\s*$/i;
const OPT_IN = /^\s*(start|unstop|yes)\s*$/i;

// One turn at a time per conversation, so replies never cross.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

async function notifyFrontDesk(business, text) {
  if (!business.frontDeskPhone) return;
  // Keep personal details out of the SMS; staff read them in the dashboard.
  await sendSms(business, business.frontDeskPhone, `${business.name}: ${text} Open ${env.publicBaseUrl}/dashboard`);
}

async function afterTurn(business, conversation, result) {
  if (result.lead) {
    const { lead, isNew, statusChanged } = db.upsertLead(conversation.id, business.id, result.lead);
    const label = business.pack.jobTypes[lead.job_type] || "New request";
    const who = business.pack.contact.one;
    if (isNew) {
      await notifyFrontDesk(business, `new ${lead.urgency === "emergency" ? "URGENT " : ""}${who} lead (${label}).`);
    } else if (statusChanged && lead.status === "requested") {
      await notifyFrontDesk(business, `appointment request to confirm (${label}).`);
    }
  }
  if (result.escalate && !conversation.escalation_notified) {
    db.markEscalationNotified(conversation.id);
    await notifyFrontDesk(business, "a conversation needs a person.");
  }
}

/**
 * Handles one incoming message on any channel and returns the assistant reply
 * (or null when nothing should be sent back).
 */
export async function handleIncomingMessage({ business, channel, contact, text }) {
  const conversation = db.getOrCreateConversation(business.id, channel, contact);

  if (channel === "sms") {
    if (OPT_OUT.test(text)) {
      db.setOptedOut(conversation.id, true);
      return null; // Twilio sends the carrier-required opt-out confirmation.
    }
    if (OPT_IN.test(text) && conversation.opted_out) {
      db.setOptedOut(conversation.id, false);
      return null;
    }
    if (conversation.opted_out) return null;
  }

  db.addMessage(conversation.id, "user", text);

  return withLock(conversation.id, async () => {
    const fresh = db.getConversation(conversation.id);
    const messages = db.getMessages(fresh.id);
    if (messages[messages.length - 1]?.role !== "user") return null; // already answered in an earlier turn

    let result;
    if (db.countUserMessages(fresh.id) > MAX_USER_MESSAGES) {
      result = fallbackResult();
    } else {
      try {
        result = await runAgent({ business, channel, messages });
      } catch (err) {
        console.error("[agent] request failed:", err?.status ?? "", err?.message ?? err);
        result = fallbackResult();
      }
    }

    db.addMessage(fresh.id, "assistant", result.reply);
    if (channel === "sms") await sendSms(business, contact, result.reply);
    await afterTurn(business, fresh, result);
    return result.reply;
  });
}

/** A call to the business went unanswered: text the caller first. */
export async function handleMissedCall({ business, callerPhone }) {
  const conversation = db.getOrCreateConversation(business.id, "sms", callerPhone);
  if (conversation.opted_out) return;
  const greeting = business.greeting.sms;
  db.addMessage(conversation.id, "assistant", greeting);
  await sendSms(business, callerPhone, greeting);
}
