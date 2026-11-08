import { test, expect, type Page } from "@playwright/test";
const cases = [
  { title: "Unspecified Quest", status: "Played", label: "Played" },
  { title: "Completed Quest", status: "Played", completion: "Completed", label: "Completed" },
  { title: "Mastered Quest", status: "Played", completion: "Mastered", label: "Mastered" },
  { title: "Abandoned Quest", status: "Played", completion: "Abandoned", label: "Abandoned" },
  { title: "Shelved Quest", status: "Played", completion: "Shelved", label: "Shelved" },
  { title: "Backlog Quest", status: "Backlog", completion: "Completed", label: "Backlog" },
  { title: "Playing Quest", status: "Playing", label: "Playing" },
  { title: "Wishlist Quest", status: "Wishlist", label: "Wishlist" },
];
const games = cases.map((item, index) => ({
  igdbId: 10301 + index,
  title: item.title,
  slug: `quest-${index}`,
  developer: "Test",
  releaseYear: 2020,
  genres: ["RPG"],
  platforms: ["PC"],
  addedAt: index + 1,
  updatedAt: 1,
}));
const fixture = {
  version: 2,
  games,
  logs: cases.map((item, index) => ({
    igdbId: 10301 + index,
    status: item.status,
    completion: item.completion,
    rating: 4.5,
    createdAt: 1,
    updatedAt: 1,
  })),
  lists: [],
  tags: [],
};
async function seed(page: Page) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: url.pathname.endsWith("/platforms")
        ? { platforms: [] }
        : url.pathname.endsWith("/platform-games")
          ? { games, hasMore: false }
          : url.pathname.endsWith("/search")
            ? games.map((game) => ({
                id: game.igdbId,
                name: game.title,
                slug: game.slug,
                platforms: [{ name: "PC" }],
              }))
            : [],
    });
  });
  await page.route("https://www.cheapshark.com/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "status.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
}
async function checkLabels(page: Page) {
  for (const item of cases) {
    const card = page.locator(".cover-card-container").filter({
      has: page.getByRole("button", {
        name: `${item.title}, Status: ${item.status}`,
        exact: true,
      }),
    });
    const status = card.locator(".fui-Badge");
    await expect(status).toHaveText(item.label);
    {
      await expect(card.locator(".card-metadata-status")).toHaveCount(0);
      await expect(status).not.toHaveAttribute("tabindex", "0");
    }
    expect(
      await card
        .locator(".card-metadata-row")
        .evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
  }
}
for (const width of [1280, 575])
  test(`Windows status badges reflect real outcomes without clipping at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await page.goto("/");
    await page.getByLabel("Grid view", { exact: true }).click();
    await checkLabels(page);
    await page.goto("/search?q=quest");
    await checkLabels(page);
    await page.goto("/systems/167?name=PlayStation%205");
    await checkLabels(page);
  });
