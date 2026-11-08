import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [1, 2].map((id) => ({
    igdbId: 8200 + id,
    title: id === 1 ? "Mountain Quest" : "Garden Days",
    slug: `test-${id}`,
    developer: "Test",
    releaseYear: 2020,
    genres: ["Adventure"],
    platforms: ["PC"],
    addedAt: new Date("2025-01-01T12:00:00Z").getTime(),
    updatedAt: 1,
  })),
  logs: [
    {
      igdbId: 8201,
      status: "Played",
      completion: "Completed",
      finishedAt: "2025-10-28",
      timePlayed: 49.6,
      playSessions: [
        { date: "2025-10-28", durationMinutes: 60 },
        { date: "2026-10-27", durationMinutes: 90 },
        { date: "2026-10-28" },
      ],
      createdAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 8202,
      status: "Played",
      completion: "Abandoned",
      finishedAt: "2026-10-26",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T12:00:00Z"));
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
async function seed(page: Page, data: unknown = fixture) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "activity-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/activity");
}
test("journal totals, filters, memories and keyboard navigation use recorded activity", async ({
  page,
}) => {
  await seed(page);
  await expect(page.getByRole("article", { name: "Active play days", exact: true })).toContainText(
    "3"
  );
  await expect(
    page.getByRole("article", { name: "Recorded session hours", exact: true })
  ).toContainText("1.5h");
  await expect(
    page.getByRole("article", { name: "Completed or mastered", exact: true })
  ).toContainText("0");
  await expect(page.getByRole("region", { name: "On this day" })).toContainText("2025");
  const journal = page.getByRole("region", { name: "Journal entries", exact: true });
  await expect(journal.getByRole("button", { name: "Stopped playing: Garden Days" })).toBeVisible();
  await page.getByLabel("Journal entry type", { exact: true }).selectOption("session");
  await expect(journal.getByRole("button")).toHaveCount(2);
  await page.getByLabel("Find a game in activity", { exact: true }).fill("Garden");
  await expect(journal).toContainText("No entries");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Journal date", { exact: true }).fill("2025-10-28");
  await expect(journal.getByRole("button")).toHaveCount(2);
  await journal.getByRole("button", { name: "Completed game: Mountain Quest" }).press("Enter");
  await expect(page).toHaveURL(/game\/8201$/);
});
test("calendar cells stay compact, support arrow keys and select the journal date", async ({
  page,
}) => {
  await seed(page);
  const cells = page.locator(".activity-day");
  await expect(cells).toHaveCount(365);
  const calendar = page.locator(".activity-calendar-scroll");
  expect(await calendar.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(
    await calendar.evaluate((el) => el.clientWidth)
  );
  expect((await cells.last().boundingBox())!.width).toBeLessThan(20);
  await cells.last().focus();
  await page.keyboard.press("ArrowUp");
  await expect(cells.nth(363)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Journal date", { exact: true })).toHaveValue("2026-10-27");
  await expect(page.getByLabel("Journal period", { exact: true })).toHaveValue("all");
  await page.getByRole("button", { name: "Clear day", exact: true }).click();
  await expect(page.getByLabel("Journal date", { exact: true })).toHaveValue("");
});
test("Fluent tabs, achievement progress and prior-year reviews work with keyboard and focus", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("tab", { name: "Achievements", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Library achievements", exact: true })
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Unlocked \(/ }).click();
  await expect(page.getByRole("article", { name: "First Step", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^Not unlocked \(/ }).click();
  await expect(page.getByRole("article", { name: "First Step", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Time Invested", exact: true })).toContainText(
    "Not unlocked"
  );
  const trigger = page.getByRole("button", { name: "Year in review", exact: true });
  await trigger.click();
  await page.getByLabel("Review year", { exact: true }).selectOption("2025");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2025 year in review");
  await expect(dialog).toContainText("1h");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog).toContainText("2 of 5");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("compact empty Activity keeps the calendar scroll inside the page", async ({ page }) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page, { ...fixture, games: [], logs: [] });
  await expect(page.getByRole("article", { name: "Active play days", exact: true })).toContainText(
    "0"
  );
  await expect(page.getByRole("region", { name: "Journal entries", exact: true })).toContainText(
    "No entries"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  const calendar = page.locator(".activity-calendar-scroll");
  expect(await calendar.evaluate((el) => el.scrollWidth)).toBeGreaterThan(
    await calendar.evaluate((el) => el.clientWidth)
  );
});
