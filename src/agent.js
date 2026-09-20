import Anthropic from "@anthropic-ai/sdk";
import { jobTypeKeys, verticalRules } from "./verticals.js";

const MODEL = "claude-opus-5";

const URGENCY = ["emergency", "soon", "routine"];
const STATUS = ["requested", "callback", "followup"];

/** The output shape depends on the industry, so it is built once per vertical and reused. */
const schemaCache = new Map();

function outputSchema(business) {
  const pack = business.pack;
  const cached = schemaCache.get(business.vertical);
  if (cached) return cached;

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["reply", "escalate", "lead"],
    properties: {
      reply: { type: "string", description: `The message sent to the ${pack.contact.one}.` },
      escalate: {
        type: "boolean",
        description:
          "True when a human at the front desk should step in now (emergency, complaint, asks for a person, or a question you cannot answer).",
      },
      lead: {
        type: "object",
        additionalProperties: false,
        required: ["captured", "name", "phone", "language", "job_type", "qualifier", "urgency", "status", "preferred_time", "summary"],
        properties: {
          captured: { type: "boolean", description: `True once you know the ${pack.contact.one}'s name AND what they need.` },
          name: { type: "string" },
          phone: { type: "string", description: "Only if they gave it. Empty otherwise." },
          language: { type: "string", enum: ["en", "es"] },
          job_type: { type: "string", enum: jobTypeKeys(pack) },
          qualifier: {
            type: "string",
            description: pack.qualifier ? `${pack.qualifier.label}: ${pack.qualifier.collect}. Empty if unknown.` : "Leave empty.",
          },
          urgency: { type: "string", enum: URGENCY },
          status: {
            type: "string",
            enum: STATUS,
            description: "requested = they chose a preferred day/time; callback = urgent or wants a call; followup = still deciding.",
          },
          preferred_time: { type: "string", description: "Their preferred day/time in plain words, or empty." },
          summary: { type: "string", description: "One short line in English for the front desk." },
        },
      },
    },
  };
  schemaCache.set(business.vertical, schema);
  return schema;
}

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

/** Stable per business, so it is cached across requests. */
function businessPrompt(business) {
  const pack = business.pack;
  const hours = Object.entries(business.hours)
    .map(([d, h]) => `${d}: ${h ?? "closed"}`)
    .join(", ");
  const qualifierLine =
    pack.qualifier && business.qualifierOptions.length ? `${pack.qualifier.optionsLabel}: ${business.qualifierOptions.join("; ")}\n` : "";
  const collect = pack.qualifier ? `, ${pack.qualifier.collect}` : "";

  return `You are the virtual front-desk assistant for ${business.name}, ${pack.describes}. You talk with ${pack.contact.plural} by website chat or SMS, in English or Spanish.

<business_facts>
Phone: ${business.phone}
Address: ${business.address}
Hours: ${hours}
${qualifierLine}Services: ${business.services.join(", ")}
Offers and payment options: ${business.offers.join(" ") || "none"}
${business.extraNotes ? `Other notes: ${business.extraNotes}` : ""}
</business_facts>

Your job: answer their questions using only the business facts, understand what they need, and collect their first and last name, what they need${collect}, and a preferred day and time within business hours. On the website also ask for a mobile number; on SMS you already have it. Ask for one thing at a time and keep it natural.

How to write:
- Reply in their language. In Spanish use "usted". Warm, brief, human.
- Website chat: at most 3 short sentences. SMS: at most 2 short sentences, under 300 characters.
- Plain text only: no markdown, no lists, no emoji.

Scheduling: you cannot see the real calendar. Take their preferred day and time and tell them the front desk will text to confirm. Never say anything is booked or confirmed.

Safety and privacy:
${verticalRules(pack, business.name)}

Fill the lead fields with everything known so far in the whole conversation, even if they mentioned it several messages ago.`;
}

function formatInZone(date, timeZone, opts) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
}

/** Changes at most once a day, placed after the cached business prompt. */
function dayContext(business, channel, greeting) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const key = formatInZone(d, business.timezone, { weekday: "short" }).toLowerCase();
    const label = formatInZone(d, business.timezone, { weekday: "short", month: "short", day: "numeric" });
    days.push(`${label}${i === 0 ? " (today)" : ""}: ${business.hours[key] ?? "closed"}`);
  }
  const known = channel === "sms" ? `SMS (the ${business.pack.contact.one}'s phone number is already known)` : "website chat";
  return `Channel: ${known}.
The conversation opened with this message from the business: "${greeting}"
Next 7 days (business time zone ${business.timezone}):
${days.join("\n")}`;
}

/** Builds alternating user/assistant turns that start with the contact. */
function toTurns(messages, timeZone) {
  const turns = [];
  for (const m of messages) {
    if (!turns.length && m.role === "assistant") continue;
    const text =
      m.role === "user"
        ? `[${formatInZone(new Date(m.created_at), timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}] ${m.content}`
        : m.content;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n${text}`;
    else turns.push({ role: m.role, content: text });
  }
  return turns;
}

export function fallbackResult() {
  return {
    reply: "Thanks for your message! Someone from our team will reach out shortly. / ¡Gracias por su mensaje! Le contactaremos en breve.",
    escalate: true,
    lead: null,
  };
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeLead(business, lead) {
  if (!lead || !lead.captured || !clean(lead.name, 80)) return null;
  const types = jobTypeKeys(business.pack);
  return {
    name: clean(lead.name, 80),
    phone: clean(lead.phone, 30),
    language: lead.language === "es" ? "es" : "en",
    job_type: types.includes(lead.job_type) ? lead.job_type : "other",
    qualifier: business.pack.qualifier ? clean(lead.qualifier, 120) : "",
    urgency: URGENCY.includes(lead.urgency) ? lead.urgency : "routine",
    status: STATUS.includes(lead.status) ? lead.status : "followup",
    preferred_time: clean(lead.preferred_time, 80),
    summary: clean(lead.summary, 200),
  };
}

/**
 * Runs one assistant turn.
 * @returns {Promise<{reply: string, escalate: boolean, lead: object|null}>}
 */
export async function runAgent({ business, channel, messages }) {
  const turns = toTurns(messages, business.timezone);
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    throw new Error("runAgent needs a conversation that ends with a message from the public.");
  }

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: outputSchema(business) },
    },
    system: [
      { type: "text", text: businessPrompt(business), cache_control: { type: "ephemeral" } },
      { type: "text", text: dayContext(business, channel, business.greeting[channel]) },
    ],
    messages: turns,
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.warn(`[agent] stop_reason=${response.stop_reason}; sending fallback reply`);
    return fallbackResult();
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn("[agent] could not parse model output; sending fallback reply");
    return fallbackResult();
  }

  const reply = clean(parsed.reply, channel === "sms" ? 480 : 1000);
  if (!reply) return fallbackResult();
  return { reply, escalate: parsed.escalate === true, lead: sanitizeLead(business, parsed.lead) };
}
