import { test, expect } from "@playwright/test";
for (const width of [1280, 575]) {
  test(`Add game labels fit their buttons at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/**", (route) =>
      route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
    );
    await page.route("**/api/igdb/search?*", (route) =>
      route.fulfill({
        json: [
          {
            id: 8801,
            name: "A very long game title that should truncate before squeezing its Add action",
            slug: "long-title",
            involved_companies: [],
            platforms: [],
          },
          {
            id: 8802,
            name: "Another game",
            slug: "another-game",
            involved_companies: [],
            platforms: [],
          },
        ],
      })
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Add game to library", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add game", exact: true });
    await dialog.getByRole("textbox", { name: "Search games to add", exact: true }).fill("game");
    const title = "A very long game title that should truncate before squeezing its Add action";
    const add = dialog.getByRole("button", { name: `Add ${title}`, exact: true });
    await expect(add).toBeVisible();
    await expect(add).toHaveText("Add");
    // Text-plus-icon content must remain a normal Fluent button, not its icon slot.
    await expect(add.locator(".fui-Button__icon")).toHaveCount(0);
    expect((await add.boundingBox())!.width).toBeGreaterThanOrEqual(60);
    expect(await add.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Edit game log", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Add game to library", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Search games to add", exact: true }).fill("game");
    const added = dialog.getByRole("button", { name: `Already added ${title}`, exact: true });
    await expect(added).toBeDisabled();
    await expect(added).toHaveText("Added");
    await expect(added.locator(".fui-Button__icon")).toHaveCount(0);
    expect(await added.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    );
    const close = dialog.getByRole("button", { name: "Close dialog", exact: true });
    await expect(close.locator(".fui-Button__icon")).toHaveCount(1);
  });
}
