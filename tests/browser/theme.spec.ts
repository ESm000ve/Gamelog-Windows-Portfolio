import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
test("desktop light and dark surfaces, Fluent controls and saved selection stay in sync", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "desktop", {
      value: { platform: "win32", isElectron: true, setTheme() {} },
    })
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 243)");
  await expect(page.locator(".platform-provider").first()).toHaveCSS(
    "background-color",
    "rgb(243, 243, 243)"
  );
  await expect(page.locator("body")).toHaveCSS("color", "rgb(26, 26, 26)");
  await expect(page.locator(".settings-card").first()).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)"
  );
  await page.screenshot({ path: testInfo.outputPath("desktop-light-settings.png") });
  await page.reload();
  await expect(page.getByRole("radio", { name: "Light", exact: true })).toBeChecked();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 243)");
  await page.getByRole("button", { name: "Select Green accent", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "green");
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 243)");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(255, 255, 255)");
});
test("System follows OS changes while explicit light and dark choices stay fixed", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "desktop", {
      value: { platform: "win32", isElectron: true, setTheme() {} },
    })
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await page.getByRole("radio", { name: "System", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
