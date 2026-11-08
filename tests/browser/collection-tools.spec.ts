import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 701,
      title: "Short Quest",
      slug: "short-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["RPG"],
      platforms: ["PC"],
      timeToBeat: { finish: 3 },
      igdbRating: 90,
      addedAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 702,
      title: "Another Quest",
      slug: "another-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["RPG"],
      platforms: ["PC"],
      timeToBeat: { finish: 5 },
      igdbRating: 80,
      addedAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 703,
      title: "Puzzle Garden",
      slug: "puzzle-garden",
      developer: "Test",
      releaseYear: 2024,
      genres: ["Puzzle"],
      platforms: ["PC"],
      timeToBeat: { finish: 2 },
      igdbRating: 70,
      addedAt: 1,
      updatedAt: 1,
    },
  ],
  logs: [
    {
      igdbId: 701,
      status: "Backlog",
      notes: "Private notes stay unchanged.",
      timePlayed: 99,
      playSessions: [{ date: "2026-10-26", durationMinutes: 60 }],
      createdAt: 1,
      updatedAt: 1,
    },
    { igdbId: 702, status: "Backlog", createdAt: 1, updatedAt: 1 },
    { igdbId: 703, status: "Backlog", createdAt: 1, updatedAt: 1 },
  ],
  lists: [],
  tags: [],
};
let aiCalls = 0;
test.beforeEach(async ({ page }) => {
  aiCalls = 0;
  await page.clock.setFixedTime(new Date("2026-10-27T12:00:00Z"));
  await page.route("**/api/**", (route) => {
    if (route.request().url().includes("/api/ai/")) aiCalls++;
    return route.fulfill({
      json: route.request().url().includes("/platforms") ? { platforms: [] } : [],
    });
  });
  await page.route("**/api/igdb/detail?*", (route) => route.fulfill({ status: 503, json: {} }));
});
async function seed(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "collection-tools.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
}
async function sessions(page: Page) {
  await page.goto("/game/701");
  await page.getByRole("button", { name: "Session history", exact: true }).click();
  return page.getByRole("dialog", { name: "Session history: Short Quest", exact: true });
}
test("session edits require Save, persist after reload and preserve personal notes and total hours", async ({
  page,
}) => {
  await seed(page);
  let dialog = await sessions(page);
  await dialog.getByLabel("Session 1 minutes", { exact: true }).fill("30");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Session history", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Session history", exact: true }).click();
  await expect(dialog.getByLabel("Session 1 minutes", { exact: true })).toHaveValue("60");
  await dialog.getByLabel("Session 1 minutes", { exact: true }).fill("30");
  await dialog.getByRole("button", { name: "Add session", exact: true }).click();
  await dialog.getByLabel("Session 2 minutes", { exact: true }).fill("15");
  await dialog.getByRole("button", { name: "Save history", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("99h", { exact: true })).toBeVisible();
  await expect(page.getByText("Private notes stay unchanged.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Session history", exact: true }).click();
  await expect(dialog.getByLabel("Session 1 minutes", { exact: true })).toHaveValue("30");
  await expect(dialog.getByLabel("Session 2 minutes", { exact: true })).toHaveValue("15");
  await page.keyboard.press("Escape");
  expect(aiCalls).toBe(0);
});
test("session removal supports draft undo and persistent recovery after saving", async ({
  page,
}) => {
  await seed(page);
  const dialog = await sessions(page);
  await dialog.getByRole("button", { name: "Remove session 1", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Add session", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Undo last removal", exact: true }).click();
  await expect(dialog.getByLabel("Session 1 minutes", { exact: true })).toHaveValue("60");
  await dialog.getByRole("button", { name: "Remove session 1", exact: true }).click();
  await dialog.getByRole("button", { name: "Save history", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/settings#recently-removed");
  await page
    .getByRole("button", { name: "Restore Short Quest session history", exact: true })
    .click();
  await sessions(page);
  await expect(dialog.getByLabel("Session 1 minutes", { exact: true })).toHaveValue("60");
});
test("saved view restores search, status, layout and sort after reload without AI", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Filter library", exact: true }).fill("Short");
  await page.getByRole("tab", { name: /^Backlog/ }).click();
  await page.getByLabel("Table view", { exact: true }).click();
  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("menuitemradio", { name: "Title (A-Z)", exact: true }).click();
  await page.getByRole("button", { name: "Saved views", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Saved library views", exact: true });
  await dialog.getByRole("textbox", { name: "View name", exact: true }).fill("Short backlog");
  await dialog.getByRole("button", { name: "Save current view", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Saved views", exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Saved views", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply view Short backlog", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Filter library", exact: true })).toHaveValue(
    "Short"
  );
  await expect(page.getByRole("tab", { name: /^Backlog/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByLabel("Table view", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: "Sort: Title (A-Z)", exact: true })).toBeVisible();
  expect(aiCalls).toBe(0);
});
test("saved views can be deleted, restored and updated to current criteria", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Saved views", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Saved library views", exact: true });
  await dialog.getByLabel("View name", { exact: true }).fill("My view");
  await dialog.getByRole("button", { name: "Save current view", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete view My view", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Apply view My view", exact: true })).toHaveCount(
    0
  );
  await dialog.getByRole("button", { name: "Undo view deletion", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("textbox", { name: "Filter library", exact: true }).fill("Puzzle");
  await page.getByRole("button", { name: "Saved views", exact: true }).click();
  await dialog.getByRole("button", { name: "Update view My view", exact: true }).click();
  await expect(dialog).toContainText("Title: Puzzle");
});
test("less like this persists, changes local picks, and can be reversed or reset", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/recommend");
  const card = page.getByRole("group", { name: "Recommendation: Short Quest", exact: true });
  await card.getByRole("button", { name: "Less like this", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveCount(0);
  const prefs = page.getByRole("button", { name: /^Recommendation preferences/ });
  await expect(prefs).toBeFocused();
  await page.reload();
  await expect(card).toHaveCount(0);
  await prefs.click();
  const dialog = page.getByRole("dialog", { name: "Recommendation preferences", exact: true });
  await dialog.getByRole("button", { name: "Show Short Quest again", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Less like this", exact: true }).click();
  await expect(card).toHaveCount(0);
  await prefs.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Reset preferences", exact: true }).click();
  await expect(dialog).toContainText("No games hidden");
  await page.keyboard.press("Escape");
  await expect(card).toBeVisible();
  expect(aiCalls).toBe(0);
});
