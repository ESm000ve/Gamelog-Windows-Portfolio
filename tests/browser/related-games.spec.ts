import { test, expect, type Page } from "@playwright/test";
const related = Array.from({ length: 60 }, (_, index) => ({
  id: 9502 + index,
  name:
    index === 0
      ? "Rare Match"
      : index === 1
        ? "Popular Match"
        : `Quest ${String(index).padStart(2, "0")}`,
  slug: `quest-${index}`,
  total_rating_count: index === 0 ? 1 : 1000 - index,
  first_release_date: index === 2 ? undefined : Date.UTC(1990 + (index % 30), 0, 1) / 1000,
}));
const raw = (id = 9501) => ({
  id,
  name:
    id === 9501 ? "Source Quest" : (related.find((game) => game.id === id)?.name ?? "Another game"),
  slug: `game-${id}`,
  genres: [{ id: 31, name: "Adventure" }],
  ...(id === 9501
    ? {
        _custom_related: related,
        collections: [{ name: "Quest series", games: [related[1], related[0]] }],
        dlcs: [{ id: 9603, name: "Quest DLC", slug: "dlc", category: 1 }],
        expansions: [{ id: 9604, name: "Quest Expansion", slug: "expansion", category: 2 }],
        bundles: [{ id: 9605, name: "Quest Collection", slug: "collection", category: 3 }],
        ports: [{ id: 9601, name: "Quest Remake", slug: "remake" }],
        forks: [{ id: 9602, name: "Derived Quest", slug: "derived" }],
      }
    : { similar_games: [related[0]] }),
});
const fixture = {
  version: 2,
  games: [9501, 9502].map((id) => ({
    igdbId: id,
    title: id === 9501 ? "Source Quest" : "Rare Match",
    slug: `game-${id}`,
    developer: "Test",
    releaseYear: 2020,
    genres: ["Adventure"],
    platforms: ["PC"],
    addedAt: 1,
    updatedAt: 1,
  })),
  logs: [
    { igdbId: 9501, status: "Backlog", createdAt: 1, updatedAt: 1 },
    { igdbId: 9502, status: "Played", createdAt: 1, updatedAt: 1 },
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
      name: "related.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
}
test("related catalog order, library status and combined browsing controls are accurate", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/game/9501/related?tab=related");
  await expect(page).toHaveTitle("Related games — gamelog");
  const results = page.getByRole("list", { name: "Related game results", exact: true });
  await expect(results.getByRole("button").first()).toHaveAccessibleName("Rare Match");
  await expect(results.getByRole("button", { name: "Rare Match", exact: true })).toContainText(
    "In library · Played"
  );
  await page.getByLabel("Related library filter", { exact: true }).selectOption("in");
  await expect(results.getByRole("button")).toHaveCount(1);
  await page.getByLabel("Search related games", { exact: true }).fill("missing");
  await expect(
    page.getByRole("heading", { name: "No games match these filters", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(results.getByRole("button")).toHaveCount(48);
  await page.getByLabel("Sort related games", { exact: true }).selectOption("oldest");
  await page.getByLabel("Search related games", { exact: true }).fill("Quest 02");
  await expect(results).toContainText("Release date not listed");
});
test("related preview states its limit and categories describe their actual contents", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/game/9501");
  const section = page.getByRole("region", { name: "Related games", exact: true });
  await expect(section).toContainText("Showing 8 of 60 games");
  await expect(section.getByRole("listitem")).toHaveCount(8);
  const labels = page.locator(".related-library-label");
  const ids = await labels.evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(ids).size).toBe(ids.length);
  await section.getByRole("tab", { name: /^Versions/ }).click();
  await expect(section).toContainText("Ports, remakes and remasters");
  await section.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page).toHaveURL(/tab=ports/);
  await expect(page.getByRole("tab", { name: /^Versions/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await page.getByRole("tab", { name: /^Forks/ }).click();
  await expect(page.getByRole("button", { name: "Derived Quest", exact: true })).toBeVisible();
});
test("related filters, loaded batches and position survive visiting a game and returning", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/game/9501/related?tab=related&sort=name");
  await page.getByRole("button", { name: "Show more games (12 remaining)", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(60);
  const scroll = page.locator(".related-browser-content");
  await scroll.evaluate((element) => {
    element.scrollTop = 700;
  });
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(600);
  const target = page.getByRole("button", { name: "Quest 10", exact: true });
  await target.scrollIntoViewIfNeeded();
  const expectedTop = await scroll.evaluate((element) => element.scrollTop);
  await target.click();
  await expect(page).toHaveURL(/game\/9512$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(page.getByRole("listitem")).toHaveCount(60);
  await expect(page.getByLabel("Sort related games", { exact: true })).toHaveValue("name");
  await expect
    .poll(async () =>
      Math.abs((await scroll.evaluate((element) => element.scrollTop)) - expectedTop)
    )
    .toBeLessThan(3);
});
test("compact related pages and categories stay inside the window", async ({ page }) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page);
  await page.goto("/game/9501/related?tab=ports");
  await expect(page.getByRole("button", { name: "Quest Remake", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  await page.getByRole("button", { name: "Quest Remake", exact: true }).press("Enter");
  await expect(page).toHaveURL(/game\/9601$/);
});
test("slow and failed online related data have honest loading and recovery states", async ({
  page,
}) => {
  await seed(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let offline = true;
  await page.route("**/api/igdb/detail?*", async (route) => {
    if (offline) {
      await gate;
      return route.fulfill({ status: 503, json: {} }).catch(() => {});
    }
    return route.fulfill({ json: { game: raw(), timeToBeat: null } });
  });
  await page.goto("/game/9501/related?tab=series");
  await expect(page.getByText("Loading online related games…", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No related games listed", exact: true })
  ).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", { name: "Related games need online details", exact: true })
  ).toBeVisible();
  offline = false;
  await page.getByRole("button", { name: "Retry online details", exact: true }).click();
  await expect(page.getByRole("tab", { name: /^Series/ })).toHaveAttribute("aria-selected", "true");
});
