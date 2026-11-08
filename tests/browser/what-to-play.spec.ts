import { test, expect, type Page } from "@playwright/test";
const titles = [
  "Backlog Quest",
  "Continue Quest",
  "Old Favorite",
  "Undated Favorite",
  "Recent Favorite",
  "Anniversary Favorite",
  "Wishlist Favorite",
  "Older Unknown Estimate",
];
const hours = [3, 5, 6, 2, 1, 4, 2, undefined];
const fixture = {
  version: 2,
  games: titles.map((title, index) => ({
    igdbId: 10101 + index,
    title,
    slug: `quest-${index}`,
    developer: "Test Studio",
    releaseYear: 2020,
    genres: ["RPG"],
    platforms: ["PC"],
    ...(hours[index] ? { timeToBeat: { finish: hours[index] } } : {}),
    addedAt: 1,
    updatedAt: 1,
  })),
  logs: titles.map((_title, index) => ({
    igdbId: 10101 + index,
    status: index === 0 ? "Backlog" : index === 1 ? "Playing" : index === 6 ? "Wishlist" : "Played",
    createdAt: 1,
    updatedAt: Date.now(),
    ...(index === 2
      ? {
          finishedAt: "2024-01-01",
          completion: "Mastered",
          rating: 5,
          timePlayed: 30,
          notes: "Private replay note",
          playSessions: [{ date: "2024-01-01", durationMinutes: 60 }],
        }
      : {}),
    ...(index === 4 ? { finishedAt: "2020-01-01", playSessions: [{ date: "2026-10-27" }] } : {}),
    ...(index === 5 ? { finishedAt: "2025-10-28" } : {}),
    ...(index === 7 ? { finishedAt: "2023-01-01" } : {}),
  })),
  lists: [],
  tags: [],
};
let aiCalls = 0;
test.beforeEach(async ({ page }) => {
  aiCalls = 0;
  await page.clock.setFixedTime(new Date("2026-10-28T12:00:00Z"));
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/recommend")) {
      aiCalls++;
      const body = route.request().postDataJSON();
      expect(JSON.stringify(body)).not.toContain("Private replay note");
      expect(
        body.candidates.every((game: { id: number }) => ![10105, 10106, 10107].includes(game.id))
      ).toBe(true);
      return route.fulfill({
        json: {
          picks: [
            { id: 10107, reason: "Invalid wishlist pick" },
            { id: 10104, reason: "An eligible short replay" },
          ],
        },
      });
    }
    if (url.pathname.endsWith("/detail")) {
      const game = fixture.games.find((game) => game.igdbId === Number(url.searchParams.get("id")));
      return route.fulfill({
        json: {
          game: game ? { id: game.igdbId, name: game.title, slug: game.slug } : null,
          timeToBeat: null,
        },
      });
    }
    return route.fulfill({ json: url.pathname.endsWith("/platforms") ? { platforms: [] } : [] });
  });
});
async function seed(page: Page, wishlistOnly = false) {
  await page.goto("/settings");
  const data = wishlistOnly
    ? { ...fixture, games: [fixture.games[6]], logs: [fixture.logs[6]] }
    : fixture;
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "play.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/recommend");
  await expect(
    page.getByRole("heading", {
      name: wishlistOnly ? "No games in this play pool" : "Old Favorite",
      exact: true,
    })
  ).toBeVisible();
}
async function records(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("gamelog");
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("logs", "readonly"),
            rows = tx.objectStore("logs").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(rows.result);
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      })
  );
}
test("play pools include eligible replays, exclude wishlist/recent play and preserve an applied mood", async ({
  page,
}) => {
  await seed(page);
  await expect(page.getByRole("group", { name: /^Recommendation:/ })).toHaveCount(5);
  for (const title of ["Recent Favorite", "Anniversary Favorite", "Wishlist Favorite"])
    await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  await page
    .getByLabel("What kind of game are you looking for?", { exact: true })
    .fill("a short RPG");
  await page.getByRole("button", { name: "Get picks", exact: true }).click();
  await expect(page.getByText("Based on: “a short RPG”", { exact: true })).toBeVisible();
  await page.getByLabel("Play pool", { exact: true }).selectOption("revisit");
  await expect(page.getByRole("group", { name: /^Recommendation:/ })).toHaveCount(3);
  await expect(page.getByText("Based on: “a short RPG”", { exact: true })).toBeVisible();
  await page.getByLabel("Maximum story length", { exact: true }).selectOption("5");
  await expect(page.getByRole("group", { name: /^Recommendation:/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Undated Favorite", exact: true })).toBeVisible();
  expect(aiCalls).toBe(0);
});
test("roulette shares filters, viewing does not write, and Back restores the page without the dialog", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Play pool", { exact: true }).selectOption("revisit");
  await page.getByLabel("Maximum story length", { exact: true }).selectOption("5");
  const before = await records(page);
  await page.getByRole("button", { name: "Game roulette", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game roulette", exact: true });
  await expect(dialog).toContainText("1 eligible game");
  await dialog.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Undated Favorite", exact: true })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "View game", exact: true }).click();
  await expect(page).toHaveURL(/game\/10104$/);
  expect(await records(page)).toEqual(before);
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Play pool", { exact: true })).toHaveValue("revisit");
  await expect(page.getByLabel("Maximum story length", { exact: true })).toHaveValue("5");
});
test("roulette includes played games, does not repeat in a round and handles reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.getByLabel("Play pool", { exact: true }).selectOption("revisit");
  await page.getByRole("button", { name: "Game roulette", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game roulette", exact: true });
  const seen: string[] = [];
  for (let index = 0; index < 3; index++) {
    await dialog.getByRole("button", { name: index ? "Spin again" : "Spin", exact: true }).click();
    await expect(dialog.locator(".roulette-result h3")).toBeVisible();
    seen.push((await dialog.locator(".roulette-result h3").textContent())!);
    await expect(dialog.getByRole("button", { name: "Reveal now", exact: true })).toHaveCount(0);
  }
  expect(new Set(seen).size).toBe(3);
  expect(seen).toContain("Old Favorite");
  expect(seen).toContain("Undated Favorite");
  await dialog.getByRole("button", { name: "Spin again", exact: true }).click();
  expect(await dialog.locator(".roulette-result h3").textContent()).not.toBe(seen[2]);
});
test("recording a replay keeps its completed record and adds just one dated session", async ({
  page,
}) => {
  await seed(page);
  const card = page.getByRole("group", { name: "Recommendation: Old Favorite", exact: true });
  await card.getByRole("button", { name: "Record play today", exact: true }).click();
  await expect(page).toHaveURL(/game\/10103$/);
  const saved = (
    (await records(page)) as {
      igdbId: number;
      status: string;
      completion: string;
      finishedAt: string;
      timePlayed: number;
      notes: string;
      playSessions: { date: string }[];
    }[]
  ).find((log) => log.igdbId === 10103)!;
  expect(saved).toMatchObject({
    status: "Played",
    completion: "Mastered",
    finishedAt: "2024-01-01",
    timePlayed: 30,
    notes: "Private replay note",
  });
  expect(saved.playSessions.filter((session) => session.date === "2026-10-28")).toHaveLength(1);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Old Favorite", exact: true })).toHaveCount(0);
});
test("spin can reveal immediately, cancelling clears its timer and changing pools clears the old winner", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Game roulette", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game roulette", exact: true });
  await dialog.getByRole("button", { name: "Spin", exact: true }).click();
  await dialog.getByRole("button", { name: "Reveal now", exact: true }).click();
  await dialog.getByLabel("Roulette play pool", { exact: true }).selectOption("playing");
  await expect(
    dialog.getByRole("heading", { name: "Let roulette choose", exact: true })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Continue Quest", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Game roulette", exact: true })).toBeFocused();
  await page.getByLabel("Play pool", { exact: true }).selectOption("ready");
  await page.getByRole("button", { name: "Game roulette", exact: true }).click();
  await dialog.getByRole("button", { name: "Spin", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Game roulette", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Let roulette choose", exact: true })
  ).toBeVisible();
});
test("AI is explicit, respects eligibility and skipped rounds have recovery", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Show me others", exact: true }).click();
  await expect(page.getByText(/You have seen every eligible game/)).toBeVisible();
  expect(aiCalls).toBe(0);
  await page.getByRole("button", { name: "Refine with AI", exact: true }).click();
  await expect(page.getByRole("group", { name: /^Recommendation:/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Undated Favorite", exact: true })).toBeVisible();
  expect(aiCalls).toBe(1);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No picks left in this round", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset skipped games", exact: true }).click();
  await expect(page.getByRole("group", { name: /^Recommendation:/ })).toHaveCount(5);
  expect(aiCalls).toBe(1);
});
test("compact page and roulette fit, and command palette opens roulette reliably", async ({
  page,
}) => {
  await page.setViewportSize({ width: 575, height: 800 });
  await seed(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  const historyIndex = await page.evaluate(() => window.history.state.idx);
  await page.getByRole("button", { name: "Open command palette", exact: true }).click();
  await page.getByLabel("Search commands and library", { exact: true }).fill("roulette");
  await page.getByRole("option", { name: /Spin game roulette/ }).click();
  const dialog = page.getByRole("dialog", { name: "Game roulette", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/roulette=true/);
  expect(await page.evaluate(() => window.history.state.idx)).toBe(historyIndex);
  const box = (await dialog.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(575);
  await dialog.getByRole("button", { name: "Spin", exact: true }).click();
  await dialog.getByRole("button", { name: "Reveal now", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
});
test("wishlist-only libraries show useful empty states and cannot be spun", async ({ page }) => {
  await seed(page, true);
  await page.getByRole("button", { name: "Game roulette", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game roulette", exact: true });
  await expect(
    dialog.getByRole("heading", { name: "No games in this play pool", exact: true })
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Spin", exact: true })).toHaveCount(0);
  expect(aiCalls).toBe(0);
});
