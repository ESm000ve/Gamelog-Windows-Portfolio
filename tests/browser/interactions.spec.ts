import { test, expect, type Page } from "@playwright/test";

// Each test receives a fresh browser context (including IndexedDB/localStorage).
// No test uses real accounts, the user's running origin, or live API responses.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
async function library(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
}
async function newList(page: Page) {
  await page.goto("/lists");
  await page.getByRole("button", { name: "New list", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "New List", exact: true })).toBeVisible();
}

test("Escape dismisses the sort menu and restores trigger focus", async ({ page }) => {
  await library(page);
  const trigger = page.getByRole("button", { name: /^Sort:/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Sort games" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Sort games" })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("sort choices support arrow keys, selection and repeated reopening", async ({ page }) => {
  await library(page);
  const trigger = page.getByRole("button", { name: /^Sort:/ });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const first = page.getByRole("menuitemradio", { name: "Recently added", exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Rating", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAccessibleName("Sort: Rating");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await expect(page.getByRole("menuitemradio", { name: "Rating", exact: true })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.keyboard.press("Escape");
});

test("outside clicks and switching flyouts dismiss earlier surfaces", async ({ page }) => {
  await library(page);
  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Sort games" })).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Library filters" })).toBeVisible();
  await page.getByRole("heading", { name: "Library", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Library filters" })).toBeHidden();
});

test("filter checkboxes work with Space and Escape returns focus", async ({ page }) => {
  await library(page);
  const trigger = page.getByRole("button", { name: "Filters", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const checkbox = page.getByRole("checkbox", { name: "Backlog", exact: true });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Library filters" })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("route changes dismiss flyouts without reopening them on return", async ({ page }) => {
  await library(page);
  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("link", { name: "Lists", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("confirmation closes its menu, focuses Cancel and traps Tab", async ({ page }) => {
  await newList(page);
  const trigger = page.getByRole("button", { name: "List actions", exact: true });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Delete list", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete list?", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("heading", { name: "New List", exact: true })).toBeVisible();
});

test("native list cards support Space and Enter", async ({ page }) => {
  await newList(page);
  await page.getByRole("button", { name: "Lists", exact: true }).click();
  const card = page.getByRole("button", { name: "New List, 0 games", exact: true });
  await card.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "New List", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lists", exact: true }).click();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "New List", exact: true })).toBeVisible();
});

test("command palette supports arrow selection, Enter navigation and Escape", async ({ page }) => {
  await library(page);
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  const input = page.getByRole("combobox", { name: "Search commands and library" });
  await expect(input).toBeFocused();
  await input.fill("Lists");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/lists$/);
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("late search responses do not reopen dismissed results or cover dialogs", async ({ page }) => {
  await library(page);
  let finish: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let requested: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/igdb/search?*", async (route) => {
    requested?.();
    await released;
    await route.fulfill({ json: [] });
  });
  // The background combobox is intentionally hidden from the accessibility tree while a modal is open.
  const search = page.getByRole("combobox", {
    name: "Search games",
    exact: true,
    includeHidden: true,
  });
  await search.fill("Celeste");
  await pending;
  await page.keyboard.press("Escape");
  const response = page.waitForResponse((response) => response.url().includes("/api/igdb/search?"));
  finish?.();
  await response;
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add game" })).toBeVisible();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add game" })).toBeHidden();
});

for (const width of [1280, 760]) {
  test(`shared headers stay consistent and fit at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    for (const [path, title] of [
      ["/", "Library"],
      ["/lists", "Lists"],
      ["/systems", "Systems"],
      ["/stats", "Statistics"],
      ["/activity", "Activity"],
      ["/friends", "Friends"],
      ["/settings", "Settings"],
      ["/recommend", "What to play"],
      ["/search?q=Celeste", "Catalog search"],
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const heading = page.getByRole("heading", { name: title, exact: true, level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).toHaveCSS("font-size", "28px");
      await expect(heading).toHaveCSS("font-weight", "600");
      await expect(page.locator("main h1")).toHaveCount(1);
      const header = page.locator(".app-page-header").first();
      const bounds = await header.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
    }
  });
}

test("compact navigation closes with Escape, restores focus and dismisses on navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await library(page);
  const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Close navigation", exact: true });
  await expect(close).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(close).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("dialog").getByRole("link", { name: "Lists", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();
  await expect(close).toBeHidden();
});
