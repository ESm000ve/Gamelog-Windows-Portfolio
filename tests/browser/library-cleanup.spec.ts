import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 9201,
      title: "Mountain Quest",
      slug: "mountain",
      developer: "Test",
      releaseYear: 0,
      genres: ["Adventure"],
      platforms: ["PC", "Nintendo Switch"],
      addedAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 9202,
      title: "Garden Days",
      slug: "garden",
      developer: "Test",
      releaseYear: 2020,
      genres: ["Puzzle"],
      platforms: ["PC"],
      addedAt: 2,
      updatedAt: 1,
    },
  ],
  logs: [
    {
      igdbId: 9201,
      status: "Played",
      rating: 4.5,
      timePlayed: 0,
      completionPercentage: 0,
      completion: "Abandoned",
      createdAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 9202,
      status: "Backlog",
      platforms: ["PC", "Nintendo Switch"],
      timePlayed: 5,
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
  await page.route("https://www.cheapshark.com/**", (route) => route.fulfill({ json: [] }));
});
async function seed(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "library.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/");
}
test("table sorting and game titles support keyboard, with recorded and missing values", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Table view", { exact: true }).click();
  const table = page.getByRole("table", { name: "Library games", exact: true });
  const scroll = page.locator(".library-table-scroll");
  expect(await scroll.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(
    await scroll.evaluate((el) => el.clientWidth)
  );
  const row = table
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "Mountain Quest", exact: true }) });
  await expect(row).toContainText("Not recorded");
  await expect(row).toContainText("0h");
  await expect(row).toContainText("0% · Abandoned");
  await expect(row).not.toContainText("Nintendo Switch");
  await expect(
    table
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "Garden Days", exact: true }) })
  ).toContainText("PC, Nintendo Switch");
  const title = page.getByRole("button", { name: "Sort by title", exact: true });
  await title.focus();
  await page.keyboard.press("Enter");
  await expect(table.getByRole("columnheader").first()).toHaveAttribute("aria-sort", "ascending");
  await title.press("Enter");
  await expect(table.getByRole("columnheader").first()).toHaveAttribute("aria-sort", "descending");
  await page.getByRole("link", { name: "Mountain Quest", exact: true }).press("Enter");
  await expect(page).toHaveURL(/game\/9201$/);
});
test("custom status filters are explicit and clearing search restores all games", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Library filters", exact: true });
  await dialog.getByRole("checkbox", { name: "Backlog", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Played", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("tab", { name: "Custom status filter", exact: true })
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Filter library", { exact: true }).fill("Missing");
  await expect(
    page.getByRole("heading", { name: 'No results for "Missing"', exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters", exact: true }).click();
  await expect(page.getByLabel("Filter library", { exact: true })).toHaveValue("");
  await expect(page.getByRole("tab", { name: /^All games/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
test("compact table scroll stays contained and Library preferences survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page);
  await page.getByLabel("Table view", { exact: true }).click();
  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("menuitemradio", { name: "Title (Z-A)", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  const table = page.locator(".library-table-scroll");
  expect(await table.evaluate((el) => el.scrollWidth)).toBeGreaterThan(
    await table.evaluate((el) => el.clientWidth)
  );
  await page.reload();
  await expect(page.getByLabel("Table view", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: "Sort: Title (Z-A)", exact: true })).toBeVisible();
});
test("corrupt view preferences recover and platform filter meaning is explicit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("libraryViewMode", "bad");
    localStorage.setItem("gamelog.library-sort", "bad");
  });
  await seed(page);
  await expect(page.getByLabel("Grid view", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.getByRole("button", { name: "Sort: Recently added", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Library filters", exact: true });
  await expect(dialog.getByLabel("Platform filter source", { exact: true })).toHaveValue("catalog");
  await dialog.getByLabel("Release year minimum", { exact: true }).fill("2030");
  await dialog.getByLabel("Release year maximum", { exact: true }).fill("2020");
  await expect(dialog.getByRole("alert")).toContainText("range");
});

test("weekly pick stays compact and expands with the keyboard", async ({ page }) => {
  await seed(page);
  const toggle = page.getByRole("button", { name: "Game of the week: Garden Days", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.press("Enter");
  await expect(
    page.getByRole("link", { name: "View weekly pick: Garden Days", exact: true })
  ).toHaveAttribute("href", "/game/9202");
  await toggle.press("Enter");
  await expect(
    page.getByRole("link", { name: "View weekly pick: Garden Days", exact: true })
  ).toHaveCount(0);
});
