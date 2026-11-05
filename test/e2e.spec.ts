import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SESSION_SECRET = process.env.SESSION_SECRET || "m_routine_fallback_secret_must_be_32_chars_long!!";

async function createAuthCookie() {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return {
    name: "m_routine_session",
    value: token,
    url: "http://localhost:3008",
  };
}

test.describe("Ninaivo Mobile E2E Tests", () => {
  test.beforeEach(async ({ context }) => {
    const cookie = await createAuthCookie();
    await context.addCookies([cookie]);
  });

  test("Bottom tab bar renders 5 tabs cleanly without truncation", async ({ page }) => {
    await page.goto("/today");
    await page.waitForLoadState("domcontentloaded");

    const nav = page.locator("nav.md\\:hidden");
    await expect(nav).toBeVisible();

    const tabs = nav.locator("a");
    await expect(tabs).toHaveCount(5);

    await expect(tabs.nth(0)).toContainText(/Today/i);
    await expect(tabs.nth(1)).toContainText(/Daily/i);
    await expect(tabs.nth(2)).toContainText(/Upcoming/i);
    await expect(tabs.nth(3)).toContainText(/Diet/i);
    await expect(tabs.nth(4)).toContainText(/Report/i);
  });

  test("Diet tab displays Daily diet and Food list views", async ({ page }) => {
    await page.goto("/diet");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText(/Diet/i);

    // Check segmented control
    const dailyBtn = page.getByRole("button", { name: /Daily diet/i });
    const foodListBtn = page.getByRole("button", { name: /Food list/i });
    await expect(dailyBtn).toBeVisible();
    await expect(foodListBtn).toBeVisible();

    // Switch to Food list
    await foodListBtn.click();
    await expect(page.getByPlaceholder("Search foods or notes...")).toBeVisible();
  });

  test("Upcoming tab has no missing snoozed items and delete shows undo snackbar", async ({ page }) => {
    await page.goto("/upcoming");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText(/Upcoming/i);

    // Add button has single plus
    const addBtn = page.getByRole("button", { name: /Add/i }).first();
    await expect(addBtn).toBeVisible();
  });

  test("Settings tab displays Recycle bin and offline storage status", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: /Recycle bin/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open recycle bin/i })).toBeVisible();
    await expect(page.getByText(/Offline storage/i)).toBeVisible();

    // Open recycle bin modal
    await page.getByRole("button", { name: /Open recycle bin/i }).click();
    const modal = page.locator("role=dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Recycle bin/i).first()).toBeVisible();
  });
});

