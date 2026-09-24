import "dotenv/config";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { ROOT, env, businesses } from "./config.js";
import { pick } from "./verticals.js";
import chatRoutes from "./routes/chat.js";
import dashboardRoutes from "./routes/dashboard.js";
import twilioRoutes from "./routes/twilio.js";
import devRoutes from "./routes/dev.js";

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

app.get("/", (req, res) => res.redirect("/dashboard"));
app.get("/dashboard", (req, res) => res.sendFile(path.join(pub, "dashboard.html")));
app.get("/demo/:businessId", (req, res) => {
  if (!businesses.has(req.params.businessId)) return res.status(404).send("Unknown business");
  res.sendFile(path.join(pub, "demo.html"));
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
