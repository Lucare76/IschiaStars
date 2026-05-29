const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000").replace(/\/+$/, "");

const routes = [
  "/",
  "/admin",
  "/admin/preventivi-da-evadere",
  "/admin/preventivi",
  "/admin/preventivi/nuovo",
  "/admin/hotel",
  "/admin/statistiche",
  "/preventivi/IS-2026-001?token=preview-token-ischiastars"
];

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
let failed = false;

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal });
    const ok = response.status === 200;
    console.log(`${ok ? "OK" : "FAIL"} ${response.status} ${route}`);
    if (!ok) failed = true;
  } catch (error) {
    failed = true;
    console.log(`FAIL ERR ${route} ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (failed) process.exit(1);
