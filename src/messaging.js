import twilio from "twilio";
import { env } from "./config.js";
import { logSms } from "./db.js";

let client;
function getTwilio() {
  client ??= twilio(env.twilioAccountSid, env.twilioAuthToken);
  return client;
}

/** Sends an SMS from the business's number. In mock mode it is only saved to the database. */
export async function sendSms(business, to, body) {
  const from = business.twilioNumber || "business";
  if (env.mockSms) {
    await logSms({ businessId: business.id, direction: "out", to, from, body, status: "mock" });
    console.log(`[sms:mock] ${from} -> ${to}: ${body}`);
    return;
  }
  try {
    const msg = await getTwilio().messages.create({ from: business.twilioNumber, to, body });
    await logSms({ businessId: business.id, direction: "out", to, from, body, status: msg.status });
  } catch (err) {
    await logSms({ businessId: business.id, direction: "out", to, from, body, status: `error:${err.code || "unknown"}` });
    console.error(`[sms] failed to send to ${to}:`, err.message);
  }
}
