import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ADMIN_URL = process.env.ADMIN_URL || "http://127.0.0.1:3005";
const API_LOGIN =
  process.env.API_URL || "http://127.0.0.1:3000/api/v1/auth/login";
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "scripts",
  "output",
  "admin-scan",
);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
ensureDir(OUTPUT_DIR);

async function loginAndGetTokens() {
  try {
    const res = await fetch(API_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) throw new Error("login failed " + res.status);
    const json = await res.json();
    return json?.data?.tokens || null;
  } catch (e) {
    console.error("Login request failed:", e.message || e);
    return null;
  }
}

const routes = [
  { name: "Overview", path: "/overview" },
  { name: "Tenants", path: "/tenants" },
  { name: "Users", path: "/users" },
  { name: "Agent Fleet", path: "/agents" },
  { name: "Models", path: "/models" },
  { name: "Monitoring", path: "/monitoring" },
  { name: "Security", path: "/security" },
  { name: "Billing", path: "/billing" },
  { name: "Connectors", path: "/connectors" },
  { name: "Audit Logs", path: "/audit" },
  { name: "Platform Brain Map", path: "/brain" },
  { name: "Strategy Room", path: "/strategy" },
];

(async () => {
  const tokens = await loginAndGetTokens();
  if (!tokens) {
    console.error("Could not obtain admin tokens; aborting scan");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const networkFailures = [];

  page.on("console", (msg) =>
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    }),
  );
  page.on("requestfailed", (req) =>
    networkFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText,
    }),
  );
  page.on("response", async (res) => {
    try {
      if (res.status() >= 400)
        networkFailures.push({
          url: res.url(),
          status: res.status(),
          statusText: res.statusText(),
        });
    } catch (e) {}
  });

  await context.addInitScript(
    (t) => {
      try {
        localStorage.setItem("admin_accessToken", t.accessToken);
        if (t.refreshToken)
          localStorage.setItem("admin_refreshToken", t.refreshToken);
      } catch (e) {}
    },
    { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
  );

  // Visit base to initialize app
  await page
    .goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
    .catch(() => {});

  const result = { visited: [], consoleLogs: [], networkFailures: [] };

  for (const r of routes) {
    try {
      const url = new URL(r.path, ADMIN_URL).toString();
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
        .catch(() => {});
      await page.waitForTimeout(1200);
      await page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => {});
      const screenshotPath = path.join(
        OUTPUT_DIR,
        `${r.name.replace(/\s+/g, "_")}.png`,
      );
      await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => {});
      result.visited.push({
        name: r.name,
        path: r.path,
        screenshot: screenshotPath,
      });
    } catch (e) {
      consoleLogs.push({
        type: "error",
        text: `Error visiting ${r.name}: ${e.message}`,
      });
      result.visited.push({ name: r.name, path: r.path, error: String(e) });
    }
  }

  result.consoleLogs = consoleLogs;
  result.networkFailures = networkFailures;
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "result.json"),
    JSON.stringify(result, null, 2),
  );

  console.log("Scan complete. Output:", OUTPUT_DIR);
  await browser.close();
  process.exit(0);
})();
