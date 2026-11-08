import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 8101,
      title: "Mountain Quest",
      slug: "mountain-quest",
      developer: "Test",
      releaseYear: 1998,
      genres: ["Adventure"],
      platforms: ["PC"],
      addedAt: new Date("2025-01-01T12:00:00Z").getTime(),
      updatedAt: 1,
    },
    {
      igdbId: 8102,
      title: "Garden Days",
      slug: "garden-days",
      developer: "Test",
      releaseYear: 2021,
      genres: ["Puzzle"],
      platforms: ["PC"],
      addedAt: new Date("2026-01-01T12:00:00Z").getTime(),
      updatedAt: 1,
    },
    {
      igdbId: 8103,
      title: "Waiting Adventure",
      slug: "waiting-adventure",
      developer: "Test",
      releaseYear: 2005,
      genres: ["Adventure"],
      platforms: ["PC"],
      addedAt: new Date("2024-01-01T12:00:00Z").getTime(),
      updatedAt: 1,
    },
  ],
  logs: [
    {
      igdbId: 8101,
      status: "Played",
      rating: 5,
      timePlayed: 80,
      completion: "Mastered",
      finishedAt: "2025-01-05",
      createdAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 8102,
      status: "Played",
      rating: 4.5,
      timePlayed: 12,
      completion: "Abandoned",
      finishedAt: "2026-01-05",
      createdAt: 1,
      updatedAt: 1,
    },
    { igdbId: 8103, status: "Backlog", createdAt: 1, updatedAt: 1 },
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
      name: "stats-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/stats");
}
test("highlights identify games, distinguish outcomes, and respond to the period selector", async ({
  page,
}) => {
  await seed(page);
  const mostPlayed = page.getByRole("article", { name: "Most played", exact: true });
  await expect(
    mostPlayed.getByRole("link", { name: "Mountain Quest", exact: true })
  ).toHaveAttribute("href", "/game/8101");
  await expect(mostPlayed).toContainText("80h");
  await expect(page.getByRole("article", { name: "Completion rate", exact: true })).toContainText(
    "50%"
  );
  await expect(
    page.getByRole("table", { name: "Games by release decade", exact: true })
  ).toContainText("1990s");
  await page.getByLabel("Time range", { exact: true }).selectOption("year");
  await expect(mostPlayed).not.toContainText("Mountain Quest");
  await expect(mostPlayed).toContainText("Garden Days");
  await expect(page.getByRole("article", { name: "Completion rate", exact: true })).toContainText(
    "0%"
  );
  await expect(
    page.getByRole("article", { name: "Oldest backlog addition", exact: true })
  ).toContainText("Waiting Adventure");
  await mostPlayed.getByRole("link", { name: "Garden Days", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/8102$/);
});
test("sparse highlights explain missing information and reflow at a compact width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page, { ...fixture, games: [fixture.games[2]], logs: [fixture.logs[2]] });
  await expect(page.getByRole("article", { name: "Most played", exact: true })).toContainText(
    "No playtime recorded"
  );
  await expect(
    page.getByRole("article", { name: "Personal favorites", exact: true })
  ).toContainText("Rate a game");
  await expect(page.getByRole("article", { name: "Completion rate", exact: true })).toContainText(
    "Set an outcome"
  );
  await expect(
    page.getByRole("article", { name: "Playthrough outcomes", exact: true })
  ).toContainText("No games marked Played");
  const cards = page.locator(".statistics-highlight-card");
  for (let index = 0; index < (await cards.count()); index++) {
    const box = await cards.nth(index).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(575);
  }
});
