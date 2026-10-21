import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/production",
  outputDir: "test-results-production",
  use: { baseURL: "http://127.0.0.1:4173", channel: "msedge", headless: true },
  webServer: {
    // Build in e2e mode (empty client id) so the production test verifies the
    // no-login public build deterministically. The real `npm run build` used
    // for deployment is unchanged and still bakes in any configured client id.
    command: "npm run build -- --mode e2e && npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
