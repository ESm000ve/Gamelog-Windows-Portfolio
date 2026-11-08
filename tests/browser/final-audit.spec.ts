import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 901,
      title: "Audit Quest",
      slug: "audit-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["RPG"],
      platforms: ["PC", "PS5"],
      addedAt: 1,
      updatedAt: 1,
    },
  ],
  logs: [
    {
      igdbId: 901,
      status: "Played",
      rating: 0.5,
      timePlayed: 99,
      notes: "Reached the bridge.",
      finishedAt: "2026-10-27",
      playSessions: [{ date: "2026-10-27" }],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  lists: [],
  tags: [],
};
const raw = {
  id: 901,
  name: "Audit Quest",
  slug: "audit-quest",
  genres: [{ name: "RPG" }],
  platforms: [{ name: "PC" }],
  involved_companies: [],
};
const file = (data: unknown, name = "audit.json") => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(data)),
});
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-27T12:00:00Z"));
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
async function seed(page: Page, data: unknown = fixture) {
  await page.goto("/settings");
  await page.locator('input[type="file"]').first().setInputFiles(file(data));
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
}
test("statistics show half-stars, today's session and meaningful chart labels and bars", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/stats");
  const ratings = page.getByRole("table", { name: "Rating distribution", exact: true });
  await expect(ratings.getByRole("row", { name: "0.5 stars 1 games" })).toHaveCount(1);
  await expect(page.getByRole("table", { name: "Recorded platforms", exact: true })).toContainText(
    "Not recorded"
  );
  const today = page.locator('[title="2026-10-27: session recorded"]');
  await expect(today).toHaveCount(1);
  const chartBar = ratings.locator("..").locator('[aria-hidden="true"] > div').first();
  await expect(chartBar).toHaveAttribute("title", "0.5 stars: 1 games");
  expect((await chartBar.boundingBox())!.height).toBeGreaterThan(100);
  await expect(
    page.getByRole("table", { name: "Recorded finishes · last 12 months", exact: true })
  ).not.toContainText("stars");
  await page.getByLabel("Time range", { exact: true }).selectOption("year");
  await expect(page.getByText(/Hours are their lifetime recorded totals/)).toBeVisible();
});
test("unmatched library search hides unrelated spotlight and can be cleared in one action", async ({
  page,
}) => {
  await seed(page, { ...fixture, logs: [{ ...fixture.logs[0], status: "Backlog" }] });
  await page.goto("/");
  await expect(page.getByText("Game of the week", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Filter library", exact: true }).fill("no such game");
  await expect(page.getByText('No results for "no such game"', { exact: true })).toBeVisible();
  await expect(page.getByText("Game of the week", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search and filters", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Filter library", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Audit Quest", level: 3 })).toBeVisible();
});
test("import preview locks its source while matching and is invalidated after edits", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/igdb/search?*", async (route) => {
    await gate;
    await route.fulfill({ json: [raw] });
  });
  await page.goto("/settings");
  await page.getByRole("button", { name: "PlayStation (PSN)", exact: true }).click();
  const source = page.getByLabel("Paste your PlayStation game list", { exact: true });
  await source.fill("Audit Quest, 2h");
  await page.getByRole("button", { name: "Match & Preview PSN List", exact: true }).click();
  await expect(source).toBeDisabled();
  await expect(page.getByRole("button", { name: "Xbox Live", exact: true })).toBeDisabled();
  release();
  await expect(page.getByText("Matched Games (1 of 1 selected)", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Replace existing recorded playtime", exact: true })
  ).not.toBeChecked();
  await source.fill("A different game");
  await expect(
    page.getByRole("button", { name: "Import Selected to Backlog", exact: true })
  ).toHaveCount(0);
});
test("possible import matches require selection and existing playtime is preserved by default", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/api/igdb/search?*", (route) => route.fulfill({ json: [raw] }));
  await page.getByRole("button", { name: "PlayStation (PSN)", exact: true }).click();
  await page.getByLabel("Paste your PlayStation game list", { exact: true }).fill("Audit, 2h");
  await page.getByRole("button", { name: "Match & Preview PSN List", exact: true }).click();
  await expect(page.getByText("Matched Games (0 of 1 selected)", { exact: true })).toBeVisible();
  await expect(page.getByText(/Possible match — review \(Year\?\)/)).toBeVisible();
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Import Selected to Backlog", exact: true }).click();
  await expect(
    page.getByText("Successfully imported 1 games from PSN!", { exact: true })
  ).toBeVisible();
  await page.route("**/api/igdb/detail?*", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } })
  );
  await page.goto("/game/901");
  await expect(page.getByText("99h", { exact: true })).toBeVisible();
  await expect(page.getByText("Reached the bridge.", { exact: true })).toBeVisible();
});
test("Friends supports another comparison and keeps prior data after invalid or failed reads", async ({
  page,
}) => {
  await page.goto("/friends");
  const upload = page.getByLabel("Friend library backup", { exact: true });
  await upload.setInputFiles(file(fixture));
  await page.getByRole("button", { name: "Friend's Unique Games (1)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Audit Quest", level: 3 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Compare another library", exact: true })
  ).toBeVisible();
  await upload.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toContainText("Your previous comparison is still shown");
  await expect(page.getByRole("heading", { name: "Audit Quest", level: 3 })).toBeVisible();
  await page.route("**/api/igdb/fetch?*", (route) => route.fulfill({ status: 503, json: [] }));
  const legacy = {
    ...fixture,
    version: 1,
    games: [{ igdbId: 902, addedAt: 1, updatedAt: 1 }],
    logs: [{ igdbId: 902, status: "Backlog", createdAt: 1, updatedAt: 1 }],
  };
  await upload.setInputFiles(file(legacy));
  await expect(page.getByRole("alert")).toContainText("Your previous comparison is still shown");
  await expect(page.getByRole("heading", { name: "Audit Quest", level: 3 })).toBeVisible();
  await page.route("**/api/igdb/fetch?*", (route) =>
    route.fulfill({ json: [{ ...raw, id: 902, name: "Another Quest" }] })
  );
  await upload.setInputFiles(file(legacy));
  await page.getByRole("button", { name: "Friend's Unique Games (1)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Another Quest", level: 3 })).toBeVisible();
});
test("catalog failure preserves saved game log and recap entry with an online retry", async ({
  page,
}) => {
  await seed(page);
  await page.route("**/api/igdb/detail?*", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } })
  );
  await page.goto("/game/901");
  await expect(page.getByRole("heading", { name: "Audit Quest", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Showing saved game information" })
  ).toBeVisible();
  await expect(page.getByText("Reached the bridge.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume recap", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Resume recap: Audit Quest", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.route("**/api/igdb/detail?*", (route) =>
    route.fulfill({ json: { game: raw, timeToBeat: null } })
  );
  await page.getByRole("button", { name: "Retry online details", exact: true }).click();
  await expect(page.getByText(/Online details are unavailable/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Audit Quest", level: 1 })).toBeVisible();
});
test("main navigation renders empty states without uncaught errors at a compact width", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 640, height: 900 });
  for (const [url, title] of [
    ["/", "Library"],
    ["/lists", "Lists"],
    ["/systems", "Systems"],
    ["/recommend", "What to play"],
    ["/activity", "Activity"],
    ["/friends", "Friends"],
    ["/stats", "Statistics"],
    ["/settings", "Settings"],
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  }
  expect(errors.filter((error) => !error.includes("ResizeObserver loop"))).toEqual([]);
});

test("catalog matching failures are explained separately from missing titles", async ({ page }) => {
  await page.route("**/api/igdb/search?*", (route) => route.fulfill({ status: 503, json: [] }));
  await page.goto("/settings");
  await page.getByRole("button", { name: "PlayStation (PSN)", exact: true }).click();
  await page.getByLabel("Paste your PlayStation game list", { exact: true }).fill("Audit Quest");
  await page.getByRole("button", { name: "Match & Preview PSN List", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("catalog was unavailable");
  await expect(
    page.getByText("Catalog unavailable — try matching again", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import Selected to Backlog", exact: true })
  ).toBeDisabled();
});
test("Steam review match selection works with Space and preserves playtime by default", async ({
  page,
}) => {
  await page.route("**/api/steam/owned-games?*", (route) =>
    route.fulfill({ json: { games: [{ appid: 123, name: "Audit Quest", playtime_forever: 120 }] } })
  );
  await page.route("**/api/igdb/match-steam", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/igdb/search?*", (route) => route.fulfill({ json: [raw] }));
  await page.goto("/settings");
  await page.getByRole("textbox", { name: "SteamID64", exact: true }).fill("76561190000000000");
  await page.getByRole("button", { name: "Fetch from Steam", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review Steam import", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Overwrite existing playtimes", exact: true })
  ).not.toBeChecked();
  const match = page.getByRole("checkbox", { name: "Import Audit Quest", exact: true });
  await match.focus();
  await page.keyboard.press("Space");
  await expect(match).toBeChecked();
  await expect(page.getByRole("button", { name: "Import 1 Games", exact: true })).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(match).not.toBeChecked();
});

test("mark played today records activity once and survives a reload", async ({ page }) => {
  await seed(page, { ...fixture, logs: [{ ...fixture.logs[0], playSessions: [] }] });
  await page.route("**/api/igdb/detail?*", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/game/901");
  await page.getByRole("button", { name: "Mark played today", exact: true }).click();
  await expect(page.getByRole("button", { name: "Played today", exact: true })).toBeDisabled();
  await expect(page.getByText("99h", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Played today", exact: true })).toBeDisabled();
  await expect(page.getByText("99h", { exact: true })).toBeVisible();
});
