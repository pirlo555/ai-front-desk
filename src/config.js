import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getVertical, VERTICAL_IDS, LANGUAGES } from "./verticals.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3000);

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) throw new Error("SESSION_SECRET is required in production.");
  sessionSecret = crypto.randomBytes(32).toString("hex");
  console.warn("[config] SESSION_SECRET not set - using a temporary one (you'll be logged out on restart).");
}

export const env = {
  isProd,
  port,
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, ""),
  // Mock mode: SMS are saved to the database instead of sent, and the /dev simulator is enabled.
  mockSms: process.env.MOCK_SMS !== "false",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  sessionSecret,
};

if (!env.mockSms && (!env.twilioAccountSid || !env.twilioAuthToken)) {
  throw new Error("MOCK_SMS=false requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
}

const REQUIRED = ["id", "name", "vertical", "timezone", "phone", "address", "hours", "services", "greeting"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const BUSINESS_DIR = path.join(ROOT, "businesses");

function loadBusinesses() {
  if (!fs.existsSync(BUSINESS_DIR)) throw new Error(`Missing the "businesses" folder at ${BUSINESS_DIR}.`);
  const map = new Map();
  // Files starting with "_" are templates, not real businesses.
  for (const file of fs.readdirSync(BUSINESS_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
    const where = `businesses/${file}`;
    let business;
    try {
      business = JSON.parse(fs.readFileSync(path.join(BUSINESS_DIR, file), "utf8"));
    } catch (err) {
      throw new Error(`${where} is not valid JSON: ${err.message}`);
    }
    const missing = REQUIRED.filter((k) => business[k] == null);
    if (missing.length) throw new Error(`${where} is missing: ${missing.join(", ")}`);
    if (!/^[a-z0-9-]+$/.test(business.id)) throw new Error(`${where}: id must be lowercase letters, numbers or dashes.`);
    if (map.has(business.id)) throw new Error(`${where}: the id "${business.id}" is already used by another business file.`);
    if (!VERTICAL_IDS.includes(business.vertical)) {
      throw new Error(`${where}: vertical must be one of ${VERTICAL_IDS.join(", ")} (got "${business.vertical}").`);
    }
    for (const d of DAYS) if (!(d in business.hours)) throw new Error(`${where}: hours.${d} is missing (use null when closed).`);
    if (!business.greeting.web || !business.greeting.sms) throw new Error(`${where}: greeting needs both "web" and "sms".`);

    // Staff language: the dashboard and the SMS alerts to the front desk.
    // The public is always answered in whatever language they wrote in.
    business.language ??= "en";
    if (!LANGUAGES.includes(business.language)) {
      throw new Error(`${where}: language must be one of ${LANGUAGES.join(", ")} (got "${business.language}").`);
    }

    business.pack = getVertical(business.vertical);
    // "insurance" is the older name for this list, kept so existing dental files still load.
    business.qualifierOptions ??= business.insurance ?? [];
    business.allowedOrigins ??= [];
    business.frontDeskPhone ??= "";
    business.twilioNumber ??= "";
    business.offers ??= [];
    business.color ??= "#0F6B5C";
    map.set(business.id, business);
  }
  if (!map.size) throw new Error(`No business files found in ${BUSINESS_DIR}. Copy businesses/_template.json and edit it.`);
  return map;
}

export const businesses = loadBusinesses();

export function getBusiness(id) {
  return businesses.get(String(id || "")) || null;
}

export function getBusinessByTwilioNumber(number) {
  for (const b of businesses.values()) if (b.twilioNumber && b.twilioNumber === number) return b;
  return null;
}

export function businessPassword(businessId) {
  const key = businessId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  // CLINIC_ is the older prefix, still read so existing .env files keep working.
  return process.env[`BUSINESS_${key}_PASSWORD`] || process.env[`CLINIC_${key}_PASSWORD`] || "";
}
