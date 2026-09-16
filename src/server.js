import "dotenv/config";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { ROOT, env, clinics } from "./config.js";
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
app.get("/demo/:clinicId", (req, res) => {
  if (!clinics.has(req.params.clinicId)) return res.status(404).send("Unknown clinic");
  res.sendFile(path.join(pub, "demo.html"));
});

if (env.mockSms) {
  app.use("/dev", devRoutes);
  app.get("/simulator", (req, res) => res.sendFile(path.join(pub, "simulator.html")));
}

app.use((err, req, res, next) => {
  console.error("[server]", err);
  res.status(500).json({ error: "Something went wrong on our side. Try again in a moment." });
});

app.listen(env.port, () => {
  console.log(`\nDental leads agent running at ${env.publicBaseUrl}`);
  console.log(`  Dashboard:      ${env.publicBaseUrl}/dashboard`);
  for (const id of clinics.keys()) console.log(`  Demo website:   ${env.publicBaseUrl}/demo/${id}`);
  if (env.mockSms) console.log(`  SMS simulator:  ${env.publicBaseUrl}/simulator   (MOCK_SMS on: no real texts are sent)`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("\n  ANTHROPIC_API_KEY is not set: the assistant will only send the fallback reply.");
});
