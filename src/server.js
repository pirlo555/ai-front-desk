import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { ROOT, env, businesses } from "./config.js";
import { pick } from "./verticals.js";
import chatRoutes from "./routes/chat.js";
import dashboardRoutes from "./routes/dashboard.js";
import twilioRoutes from "./routes/twilio.js";
import devRoutes from "./routes/dev.js";
import { initDb } from "./db.js";

const app = express();
app.disable("x-powered-by");
if (env.isProd) app.set("trust proxy", 1);
app.use(cookieParser(env.sessionSecret));

app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const pub = path.join(ROOT, "public");
app.use(express.static(pub, { index: false }));

app.use("/api", chatRoutes);
app.use("/api/desk", dashboardRoutes);
app.use("/twilio", twilioRoutes);

// Carrier A2P registration requires both pages to be publicly reachable, with
// those exact titles and the wording they check for. Keep them served.
app.get("/privacy", (req, res) => res.sendFile(path.join(pub, "privacy.html")));
app.get("/terms", (req, res) => res.sendFile(path.join(pub, "terms.html")));

app.get("/", (req, res) => res.redirect("/dashboard"));
app.get("/dashboard", (req, res) => res.sendFile(path.join(pub, "dashboard.html")));
/**
 * The demo page doubles as the opt-in evidence an A2P reviewer reads, so it is
 * filled in on the server: the automated checks that fetch this URL do not run
 * JavaScript, and a page that paints itself in the browser looks empty to them.
 */
const DEMO_COPY = {
  en: {
    bar: "Example page: this stands in for the business's own website. The chat bubble in the corner is the real assistant.",
    lede: "Open the chat in the bottom-right corner and write as a customer would, in English or Spanish. New leads show up in the dashboard.",
    ctaLabel: "Call us",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    sms: (name) =>
      `If we miss your call, ${name} will text you back at the number you called from, so we can help you without you having to call again. ` +
      `Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
  },
  es: {
    bar: "Página de ejemplo: hace de web del negocio. La burbuja de chat de la esquina sí es el asistente de verdad.",
    lede: "Abra el chat en la esquina de abajo a la derecha y escriba como lo haría un cliente suyo, en español o en inglés. Los contactos nuevos aparecen en el panel.",
    ctaLabel: "Llámenos",
    privacy: "Política de privacidad",
    terms: "Términos y condiciones",
    sms: (name) =>
      `Si no alcanzamos a contestarle, ${name} le responderá por mensaje de texto al número desde el que llamó, para ayudarle sin que tenga que volver a llamar. ` +
      `La frecuencia de los mensajes varía. Pueden aplicarse tarifas de mensajes y datos. Responda STOP para no recibir más mensajes, o HELP para obtener ayuda.`,
  },
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let demoTemplate = null;

app.get("/demo/:businessId", (req, res, next) => {
  const business = businesses.get(req.params.businessId);
  if (!business) return res.status(404).send("Unknown business");
  try {
    demoTemplate ??= fs.readFileSync(path.join(pub, "demo.html"), "utf8");
    const c = DEMO_COPY[business.language] || DEMO_COPY.en;
    const values = {
      LANG: business.language,
      ID: business.id,
      NAME: business.name,
      PHONE: business.phone,
      TEL_HREF: String(business.phone).replace(/[^0-9+]/g, ""),
      BAR: c.bar,
      LEDE: c.lede,
      CTA_LABEL: c.ctaLabel,
      SMS: c.sms(business.name),
      PRIVACY_LABEL: c.privacy,
      TERMS_LABEL: c.terms,
    };
    const html = demoTemplate.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? escapeHtml(values[k]) : m));
    res.type("html").send(html);
  } catch (err) {
    next(err);
  }
});

// The simulator fakes inbound SMS with no authentication, which is what makes
// it useful on a laptop and dangerous on a public server: anyone who found the
// URL could drive real model calls and spend the account's credit. Mock mode
// alone stopped being a sufficient gate once the app became reachable.
const devTools = env.mockSms && !env.isProd;
if (devTools) {
  app.use("/dev", devRoutes);
  app.get("/simulator", (req, res) => res.sendFile(path.join(pub, "simulator.html")));
}

app.use((err, req, res, next) => {
  console.error("[server]", err);
  res.status(500).json({ error: "Something went wrong on our side. Try again in a moment." });
});

// Startup lives in a function rather than at module top level: LiteSpeed, the
// runner Hostinger uses, loads the app with require(), which refuses any module
// graph that awaits at the top level (ERR_REQUIRE_ASYNC_MODULE).
async function main() {
  await initDb();

  app.listen(env.port, () => {
    console.log(`\nAI front desk running at ${env.publicBaseUrl}`);
    console.log(`  Dashboard:      ${env.publicBaseUrl}/dashboard`);
    for (const b of businesses.values()) {
      console.log(`  Demo website:   ${env.publicBaseUrl}/demo/${b.id}   (${b.name} - ${pick(b.pack.label, b.language)})`);
    }
    if (devTools) console.log(`  SMS simulator:  ${env.publicBaseUrl}/simulator   (MOCK_SMS on: no real texts are sent)`);
    else if (env.mockSms) console.log("  SMS simulator:  off in production (it has no login and would burn API credit)");
    if (!process.env.ANTHROPIC_API_KEY) console.warn("\n  ANTHROPIC_API_KEY is not set: the assistant will only send the fallback reply.");
  });
}

main().catch((err) => {
  console.error("[server] could not start:", err.message);
  process.exit(1);
});
