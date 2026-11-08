import { test, expect, type Page } from "@playwright/test";
const games = [
  {
    igdbId: 10201,
    title: "Final Fantasy VII Remake",
    slug: "remake",
    category: 8,
    firstReleaseDate: 1609459200,
  },
  {
    igdbId: 10202,
    title: "Final Fantasy VII Rebirth",
    slug: "rebirth",
    category: 0,
    firstReleaseDate: 1709164800,
  },
  { igdbId: 10203, title: "Final Fantasy VII DLC", slug: "dlc", category: 1 },
  { igdbId: 10204, title: "Final Fantasy VII Collection", slug: "bundle", category: 3 },
  { igdbId: 10205, title: "Chocobo Racing", slug: "chocobo", category: 0 },
];
const requests: {
  q: string;
  type: string;
  scope: string;
  offset: string;
  ids?: number[];
  method: string;
}[] = [];
test.beforeEach(async ({ page }) => {
  requests.length = 0;
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/platform-games")) {
      const q = url.searchParams.get("q") ?? "",
        type = url.searchParams.get("type") ?? "playable",
        scope = url.searchParams.get("library") ?? "all";
      const ids =
        route.request().method() === "POST" ? (route.request().postDataJSON().ids as number[]) : [];
      requests.push({
        q,
        type,
        scope,
        offset: url.searchParams.get("offset")!,
        ids,
        method: route.request().method(),
      });
      let rows = games.filter((game) =>
        type === "all" || type === "versions"
          ? type === "all" || game.category === 8
          : type === "addons"
            ? game.category === 1
            : game.category === 0 || game.category === 8
      );
      if (q)
        rows = rows.filter((game) =>
          /remake/i.test(q)
            ? game.igdbId === 10201
            : game.title.toLowerCase().includes(q.toLowerCase())
        );
      if (scope === "in") rows = rows.filter((game) => ids.includes(game.igdbId));
      if (scope === "new") rows = rows.filter((game) => !ids.includes(game.igdbId));
      return route.fulfill({ json: { games: rows, hasMore: false } });
    }
    if (url.pathname.endsWith("/detail")) {
      const id = Number(url.searchParams.get("id")),
        game = games.find((game) => game.igdbId === id)!;
      return route.fulfill({
        json: { game: { id, name: game.title, slug: game.slug }, timeToBeat: null },
      });
    }
    return route.fulfill({
      json: url.pathname.endsWith("/platforms")
        ? { platforms: [{ id: 167, name: "PlayStation 5", manufacturers: ["Sony"] }] }
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
      name: "system.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 2,
          games: [
            {
              igdbId: 10202,
              title: games[1].title,
              slug: "rebirth",
              developer: "Test",
              releaseYear: 2024,
              genres: ["RPG"],
              platforms: ["PC", "PlayStation 5"],
              addedAt: 1,
              updatedAt: 1,
            },
          ],
          logs: [{ igdbId: 10202, status: "Backlog", createdAt: 1, updatedAt: 1 }],
          lists: [],
          tags: [],
        })
      ),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/systems/167?name=PlayStation%205");
  await expect(
    page.getByRole("button", { name: "Final Fantasy VII Remake", exact: true })
  ).toBeVisible();
}
test("system catalogs expose genre, game type and library filters and default to covers", async ({
  page,
}) => {
  await seed(page);
  await expect(page.getByLabel("Cover grid", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByLabel("Catalog genre", { exact: true })).toBeVisible();
  await page.getByLabel("System game type", { exact: true }).selectOption("addons");
  await expect(
    page.getByRole("button", { name: "Final Fantasy VII DLC", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Final Fantasy VII Remake", exact: true })
  ).toHaveCount(0);
  expect(requests.at(-1)).toMatchObject({ type: "addons", offset: "0" });
});
test("title search sends all words and numbers to the full catalog and list shows classifications", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByLabel("Search games in this system", { exact: true })
    .pressSequentially("remake fantasy 7");
  await expect(page.getByLabel("Search games in this system", { exact: true })).toHaveValue(
    "remake fantasy 7"
  );
  await expect(page.getByRole("button", { name: "Chocobo Racing", exact: true })).toHaveCount(0);
  await page.getByLabel("Compact list", { exact: true }).click();
  const table = page.getByRole("table", { name: "System catalog games", exact: true });
  await expect(table).toContainText("Remake");
  await expect(table).toContainText("Release on system");
  await expect(table.getByRole("row")).toHaveCount(2);
  expect(requests.at(-1)).toMatchObject({ q: "remake fantasy 7", offset: "0" });
});
test("library filters are sent before paging with the full library ID list", async ({ page }) => {
  await seed(page);
  await page.getByLabel("System library filter", { exact: true }).selectOption("in");
  await expect(
    page.getByRole("button", { name: /Final Fantasy VII Rebirth, Status: Backlog/ })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Final Fantasy VII Remake", exact: true })
  ).toHaveCount(0);
  expect(requests.at(-1)).toMatchObject({ method: "POST", scope: "in", ids: [10202], offset: "0" });
  await page.getByLabel("System library filter", { exact: true }).selectOption("new");
  await expect(
    page.getByRole("button", { name: "Final Fantasy VII Remake", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Final Fantasy VII Rebirth/ })).toHaveCount(0);
});
test("search, type, scope and optional list restore after opening a game and using Back", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("System game type", { exact: true }).selectOption("versions");
  await page.getByLabel("System library filter", { exact: true }).selectOption("new");
  await page.getByLabel("Search games in this system", { exact: true }).fill("remake");
  await page.getByLabel("Compact list", { exact: true }).click();
  await page.getByRole("table").getByRole("button", { name: games[0].title, exact: true }).click();
  await expect(page).toHaveURL(/game\/10201$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Search games in this system", { exact: true })).toHaveValue(
    "remake"
  );
  await expect(page.getByLabel("System game type", { exact: true })).toHaveValue("versions");
  await expect(page.getByLabel("System library filter", { exact: true })).toHaveValue("new");
  await expect(page.getByRole("table")).toContainText("Remake");
  await page.reload();
  await expect(page.getByLabel("Compact list", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});
test("compact filters and list stay contained and bulk selection switches to covers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page);
  await page.getByLabel("Compact list", { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  await page.getByRole("button", { name: "Select games", exact: true }).click();
  await expect(page.getByLabel("Cover grid", { exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByLabel("Compact list", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: games[0].title, exact: true }).click();
  await expect(page.getByRole("button", { name: "Add 1 game", exact: true })).toBeVisible();
  const footer = (await page.locator(".system-catalog-bulk").boundingBox())!;
  expect(footer.x + footer.width).toBeLessThanOrEqual(575);
});
