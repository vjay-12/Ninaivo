import { defineConfig } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./test",
  testMatch: ["**/*.spec.ts"],
  timeout: 30000,
  webServer: {
    command: "npm run start",
    port: 3008,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3008",
    browserName: "chromium",
  },
  projects: [
    {
      name: "Mobile 390 (iPhone 12)",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
    {
      name: "Mobile 360 (Android Small)",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
      },
    },
    {
      name: "Mobile 430 (iPhone Pro Max)",
      use: {
        viewport: { width: 430, height: 932 },
        isMobile: true,
      },
    },
  ],
});

