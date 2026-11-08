import { test, expect } from "@playwright/test";
for (const width of [1400, 760, 640]) {
  test(`desktop title-bar controls fit and stay interactive at ${width}px`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "desktop", { value: { platform: "win32", isElectron: true } });
    });
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/**", (route) =>
      route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
    await expect(page.locator(".app-titlebar")).toHaveCSS("-webkit-app-region", "drag");
    await expect(page.locator(".app-titlebar-search .fui-Combobox")).toHaveCSS(
      "-webkit-app-region",
      "no-drag"
    );
    const search = page.getByRole("combobox", { name: "Search games", exact: true });
    await search.click();
    await expect(search).toBeFocused();
    await search.fill("testing");
    await expect(search).toHaveValue("testing");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open command palette", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Command palette", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const bounds = await page.locator(".app-titlebar").boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const commands = await page
      .getByRole("button", { name: "Open command palette", exact: true })
      .boundingBox();
    expect(commands!.x + commands!.width).toBeLessThanOrEqual(width - 140);
  });
}
