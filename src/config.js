import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

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

const REQUIRED = ["id", "name", "timezone", "phone", "address", "hours", "insurance", "services", "greeting"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function loadClinics() {
  const dir = path.join(ROOT, "clinics");
  const map = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const clinic = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const missing = REQUIRED.filter((k) => clinic[k] == null);
    if (missing.length) throw new Error(`clinics/${file} is missing: ${missing.join(", ")}`);
    if (!/^[a-z0-9-]+$/.test(clinic.id)) throw new Error(`clinics/${file}: id must be lowercase letters, numbers or dashes.`);
    for (const d of DAYS) if (!(d in clinic.hours)) throw new Error(`clinics/${file}: hours.${d} is missing (use null when closed).`);
    clinic.allowedOrigins ??= [];
    clinic.frontDeskPhone ??= "";
    clinic.twilioNumber ??= "";
    clinic.offers ??= [];
    map.set(clinic.id, clinic);
  }
  return map;
}

export const clinics = loadClinics();

export function getClinic(id) {
  return clinics.get(String(id || "")) || null;
}

export function getClinicByTwilioNumber(number) {
  for (const c of clinics.values()) if (c.twilioNumber && c.twilioNumber === number) return c;
  return null;
}

export function clinicPassword(clinicId) {
  return process.env[`CLINIC_${clinicId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PASSWORD`] || "";
}
