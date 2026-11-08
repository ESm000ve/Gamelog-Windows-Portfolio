import { test, expect } from "@playwright/test";
const platforms = [
  {
    id: 167,
    name: "PlayStation 5",
    abbreviation: "PS5",
    releaseYear: 2020,
    manufacturers: ["Sony", "12345"],
  },
  { id: 130, name: "Nintendo Switch", releaseYear: 2017, manufacturers: ["Nintendo"] },
];
const games = [
  { igdbId: 9101, title: "Mountain Quest", slug: "mountain", releaseYear: 2020 },
  { igdbId: 9102, title: "Garden Days", slug: "garden", releaseYear: 2021 },
];
const full = (id: number) => [
  {
    id,
    name: games.find((g) => g.igdbId === id)?.title,
    slug: `game-${id}`,
    first_release_date: 1577880000,
    genres: [{ name: "Adventure" }],
    platforms: [{ name: "PC" }, { name: "PlayStation 5" }],
  },
];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/platforms")) return route.fulfill({ json: { platforms } });
    if (url.pathname.endsWith("/platform-games"))
      return route.fulfill({ json: { games, hasMore: false } });
    if (url.pathname.endsWith("/fetch"))
      return route.fulfill({ json: full(Number(url.searchParams.get("id"))) });
    return route.fulfill({ json: [] });
  });
});
test("system picker filters clean metadata and remembers preferences on returning", async ({
  page,
}) => {
  await page.goto("/systems");
  await page.getByRole("tab", { name: /Browse all/ }).click();
  await expect(
    page.getByLabel("Manufacturer", { exact: true }).getByRole("option", { name: "12345" })
  ).toHaveCount(0);
  await page.getByLabel("Filter systems", { exact: true }).fill("PS5");
  await expect(page.locator(".system-browser-card")).toHaveCount(1);
  await page.getByRole("button", { name: /PlayStation 5 2020/ }).click();
  await expect(page.getByRole("heading", { name: "PlayStation 5", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to systems", exact: true }).click();
  await expect(page.getByLabel("Filter systems", { exact: true })).toHaveValue("PS5");
});
test("catalog filters validate, disclose state and stay inside compact windows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await page.goto("/systems/167?name=PlayStation%205");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("button", { name: "Filters", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await page.getByLabel("First release from", { exact: true }).fill("2027");
  await page.getByLabel("First release to", { exact: true }).fill("2020");
  await expect(page.getByRole("alert")).toContainText("start year");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("System game type", { exact: true }).selectOption("all");
  await expect(page.getByRole("button", { name: "Filters (1)", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  await page.getByRole("button", { name: "Select games", exact: true }).click();
  await page.getByRole("button", { name: "Mountain Quest", exact: true }).click();
  await page
    .getByRole("button", { name: "Garden Days", exact: true })
    .click({ modifiers: ["Shift"] });
  const footer = page.locator(".system-catalog-bulk");
  await expect(footer).toContainText("2 selected");
  await expect(page.locator(".cover-selection-indicator").first()).toHaveCSS(
    "border-radius",
    "4px"
  );
  const box = (await footer.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(575);
  expect(box.y + box.height).toBeLessThanOrEqual(850);
  await page.getByLabel("Search games in this system", { exact: true }).fill("Garden");
  await expect(footer).toContainText("0 selected");
});
test("failed catalog loads retry, and stale search responses cannot replace newer results", async ({
  page,
}) => {
  let first = true;
  await page.route("**/api/igdb/platform-games?**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (first) {
      return route.fulfill({ status: 503, json: { error: "offline" } });
    }
    if (q === "old") {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return route.fulfill({ json: { games: [games[0]], hasMore: false } }).catch(() => {});
    }
    return route.fulfill({ json: { games: q === "new" ? [games[1]] : games, hasMore: false } });
  });
  await page.goto("/systems/167?name=PlayStation%205");
  await expect(
    page.getByRole("heading", { name: "Catalog could not be loaded", exact: true })
  ).toBeVisible();
  first = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toBeVisible();
  const search = page.getByLabel("Search games in this system", { exact: true });
  await search.fill("old");
  await page.waitForRequest((r) => new URL(r.url()).searchParams.get("q") === "old");
  await search.fill("new");
  await expect(page.getByRole("button", { name: "Garden Days", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toHaveCount(0);
});
test("failed bulk preparation preserves selection; successful add and Undo are complete", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/igdb/fetch?*", (route) =>
    fail
      ? route.fulfill({ status: 503, json: { error: "offline" } })
      : route.fulfill({ json: full(Number(new URL(route.request().url()).searchParams.get("id"))) })
  );
  await page.goto("/systems/167?name=PlayStation%205");
  await page.getByRole("button", { name: "Select games", exact: true }).click();
  await page.getByRole("button", { name: "Select all loaded", exact: true }).click();
  await page.getByRole("button", { name: "Add 2 games", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Catalog unavailable");
  await expect(page.locator(".system-catalog-bulk")).toContainText("2 selected");
  fail = false;
  await page.getByRole("button", { name: "Add 2 games", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mountain Quest, Status: Backlog", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Garden Days, Status: Backlog", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toBeVisible();
});

test("pagination retries the failed page while keeping loaded games", async ({ page }) => {
  let fail = true;
  const offsets: string[] = [];
  await page.route("**/api/igdb/platform-games?**", (route) => {
    const offset = new URL(route.request().url()).searchParams.get("offset")!;
    offsets.push(offset);
    if (offset === "0") return route.fulfill({ json: { games: [games[0]], hasMore: true } });
    return fail
      ? route.fulfill({ status: 503, json: { error: "offline" } })
      : route.fulfill({ json: { games: [games[0], games[1]], hasMore: false } });
  });
  await page.goto("/systems/167?name=PlayStation%205");
  await page.getByRole("button", { name: "Load more games", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Catalog could not be loaded", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Garden Days", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toHaveCount(1);
  expect(offsets.slice(-2)).toEqual(["50", "50"]);
});
test("rapid pagination survives the initial filter debounce window", async ({ page }) => {
  const start = new Date("2026-11-08T12:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  const offsets: string[] = [];
  await page.route("**/api/igdb/platform-games?**", (route) => {
    const offset = new URL(route.request().url()).searchParams.get("offset")!;
    offsets.push(offset);
    return route.fulfill({
      json:
        offset === "0"
          ? { games: [games[0]], hasMore: true }
          : { games: [games[1]], hasMore: false },
    });
  });
  await page.goto("/systems/167?name=PlayStation%205");
  // Let React reveal the deferred screen while keeping the startup debounce pending.
  await page.clock.runFor(300);
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toBeVisible();
  // The test clock is paused so the page can load before any debounce expires.
  await page.getByRole("button", { name: "Load more games", exact: true }).click({ force: true });
  await expect(page.getByRole("button", { name: "Garden Days", exact: true })).toBeVisible();
  await page.clock.runFor(600);
  await expect(page.getByRole("button", { name: "Mountain Quest", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Garden Days", exact: true })).toBeVisible();
  expect(offsets).toEqual(["0", "50"]);
});

test("quick rating saves the personal rating and keeps catalog actions usable", async ({
  page,
}) => {
  await page.goto("/systems/167?name=PlayStation%205");
  await page.getByRole("button", { name: "Actions for Mountain Quest", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rate game", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "4.5 stars", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mountain Quest, Status: Played", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Actions for Mountain Quest", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rate game", exact: true }).hover();
  await expect(page.getByRole("menuitemradio", { name: "4.5 stars", exact: true })).toHaveAttribute(
    "aria-checked",
    "true"
  );
});
