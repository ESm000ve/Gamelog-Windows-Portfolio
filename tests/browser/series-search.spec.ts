import { test, expect, type Page } from "@playwright/test";
const entries = [
  {
    id: 9702,
    name: "Final Fantasy VII Remake",
    slug: "remake",
    game_type: { id: 108, type: "Remake" },
    first_release_date: 1586476800,
  },
  {
    id: 9703,
    name: "Final Fantasy VII Rebirth",
    slug: "rebirth",
    game_type: { id: 100, type: "Main Game" },
    first_release_date: 1709164800,
  },
  {
    id: 9704,
    name: "Final Fantasy VII Collection",
    slug: "collection",
    game_type: { id: 103, type: "Bundle" },
  },
  { id: 9705, name: "Final Fantasy VII Unknown Edition", slug: "unknown" },
];
const wide = [
  { id: 9801, name: "Chocobo Racing", slug: "chocobo", game_type: { id: 100, type: "Main Game" } },
  { id: 9802, name: "Final Fantasy XVII", slug: "ff17", game_type: { id: 100, type: "Main Game" } },
];
const raw = (id = 9701) => ({
  id,
  name:
    id === 9701
      ? "Final Fantasy VII"
      : (entries.find((game) => game.id === id)?.name ?? "Another game"),
  slug: `game-${id}`,
  genres: [{ name: "RPG" }],
  ...(id === 9701
    ? {
        collections: [{ name: "Final Fantasy VII", slug: "ffvii", games: entries }],
        franchises: [
          { name: "Final Fantasy", slug: "final-fantasy", games: [...entries, ...wide] },
        ],
      }
    : {}),
});
const fixture = {
  version: 2,
  games: [9701, 9703].map((id) => ({
    igdbId: id,
    title: raw(id).name,
    slug: `game-${id}`,
    developer: "Test",
    releaseYear: 2024,
    genres: ["RPG"],
    platforms: ["PC"],
    addedAt: 1,
    updatedAt: 1,
  })),
  logs: [
    { igdbId: 9701, status: "Playing", createdAt: 1, updatedAt: 1 },
    { igdbId: 9703, status: "Backlog", createdAt: 1, updatedAt: 1 },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: url.pathname.endsWith("/detail")
        ? { game: raw(Number(url.searchParams.get("id"))), timeToBeat: null }
        : url.pathname.endsWith("/platforms")
          ? { platforms: [] }
          : [],
    });
  });
});
async function seed(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "series.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/game/9701/related?tab=series");
}
test("Series defaults to covers and supports an optional focused list", async ({ page }) => {
  await seed(page);
  await expect(page.getByLabel("Cover grid", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.getByLabel("Compact list", { exact: true }).click();
  const table = page.getByRole("table", { name: "Related games list", exact: true });
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(table).not.toContainText("Chocobo Racing");
  await expect(table).toContainText("In library · Backlog");
  await page.getByLabel("Series group", { exact: true }).selectOption("all");
  await expect(table).toContainText("Chocobo Racing");
  await expect(page).toHaveURL(/series_group=all/);
  await page.getByLabel("Series group", { exact: true }).selectOption("collection:ffvii");
  await expect(table).not.toContainText("Chocobo Racing");
});
test("title words and Arabic sequel numbers find a Roman-numbered title without scrolling", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByLabel("Search related games", { exact: true })
    .pressSequentially("remake fantasy 7");
  await expect(page.getByLabel("Search related games", { exact: true })).toHaveValue(
    "remake fantasy 7"
  );
  await page.getByLabel("Compact list", { exact: true }).click();
  const table = page.getByRole("table", { name: "Related games list", exact: true });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Final Fantasy VII Remake");
  await page.getByLabel("Series group", { exact: true }).selectOption("all");
  await expect(table).not.toContainText("Final Fantasy XVII");
  await page.getByLabel("Cover grid", { exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
});
test("game type narrows editions while keeping unknown classification explicit", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Compact list", { exact: true }).click();
  await page.getByLabel("Related game type", { exact: true }).selectOption("games");
  await expect(page.getByRole("table")).toContainText("Rebirth");
  await expect(page.getByRole("table")).not.toContainText("Remake");
  await page.getByLabel("Related game type", { exact: true }).selectOption("versions");
  await expect(page.getByRole("table")).toContainText("Remake");
  await expect(page.getByRole("table")).not.toContainText("Rebirth");
  await page.getByLabel("Related game type", { exact: true }).selectOption("unknown");
  await expect(page.getByRole("table")).toContainText("Unknown Edition");
  await expect(page.getByRole("table")).toContainText("Not classified");
});
test("inline Series search carries the query into the full browser and survives returning", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Back to game", exact: true }).click();
  const section = page.getByRole("region", { name: "Related games", exact: true });
  await section.getByLabel("Find a series entry", { exact: true }).fill("rebirth");
  await expect(section.getByRole("listitem")).toHaveCount(1);
  await section.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Search related games", { exact: true })).toHaveValue("rebirth");
  await page.getByRole("button", { name: "Final Fantasy VII Rebirth", exact: true }).click();
  await expect(page).toHaveURL(/game\/9703$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Search related games", { exact: true })).toHaveValue("rebirth");
  await expect(page.getByLabel("Cover grid", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});
test("compact series list scrolls internally and choices survive a reload", async ({ page }) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page);
  await page.getByLabel("Compact list", { exact: true }).click();
  await page.getByLabel("Series group", { exact: true }).selectOption("all");
  await page.getByLabel("Related game type", { exact: true }).selectOption("versions");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  await page.reload();
  await expect(page.getByLabel("Series group", { exact: true })).toHaveValue("all");
  await expect(page.getByLabel("Related game type", { exact: true })).toHaveValue("versions");
  await expect(page.getByRole("table")).toContainText("Remake");
});
