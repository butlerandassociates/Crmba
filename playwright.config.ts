import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/old-*.spec.ts",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false, // sequential — groups 3-17 share client state
  retries: 0,
  workers: 1,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: "tests/results/report.json" }],
    ["html", { outputFolder: "tests/results/html", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    storageState: "tests/auth.json",  // reused across all tests — login runs once
    headless: false,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15000,
    permissions: ["geolocation", "notifications", "clipboard-read", "clipboard-write"],
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
