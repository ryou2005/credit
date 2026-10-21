import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    // --mode e2e loads .env.e2e (empty client id), so tests exercise the
    // no-login flows regardless of a developer's local .env.local.
    command: "npm run dev -- --port 5174 --mode e2e",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
