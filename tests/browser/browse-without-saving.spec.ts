import { test, expect, type Page } from "@playwright/test";
const raw = {
  id: 10001,
  name: "Browse Quest",
  slug: "browse-quest",
  first_release_date: 1577880000,
  genres: [{ name: "Adventure" }],
  platforms: [{ name: "PC" }, { name: "PlayStation 5" }],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const id = Number(url.searchParams.get("id")) || 10001;
    return route.fulfill({
      json: url.pathname.endsWith("/detail")
        ? {
            game: {
              ...raw,
              id,
              ...(id === 10002
                ? {
                    name: "Source Quest",
                    collections: [{ name: "Quest", slug: "quest", games: [raw] }],
                  }
                : {}),
            },
            timeToBeat: null,
          }
        : url.pathname.endsWith("/fetch") || url.pathname.endsWith("/search")
          ? [raw]
          : url.pathname.endsWith("/platforms")
            ? { platforms: [{ id: 167, name: "PlayStation 5" }] }
            : url.pathname.endsWith("/platform-games")
              ? {
                  games: [{ igdbId: raw.id, title: raw.name, slug: raw.slug, releaseYear: 2020 }],
                  hasMore: false,
                }
              : url.pathname.endsWith("/parse-log")
                ? { title: raw.name, logFields: { status: "Played", rating: 4.5, platform: "PC" } }
                : [],
    });
  });
});
async function library(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        games: unknown[];
        logs: { status: string; rating?: number; platforms?: string[] }[];
      }>((resolve, reject) => {
        const request = indexedDB.open("gamelog");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(["games", "logs"], "readonly");
          const games = tx.objectStore("games").getAll();
          const logs = tx.objectStore("logs").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve({ games: games.result, logs: logs.result });
          };
          tx.onerror = () => reject(tx.error);
        };
      })
  );
}
async function empty(page: Page) {
  expect(await library(page)).toEqual({ games: [], logs: [] });
}
async function cancelDraft(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Edit game log", exact: true });
  await expect(dialog).toContainText("Not in your library yet");
  await expect(
    dialog.getByRole("button", { name: "Remove from library", exact: true })
  ).toHaveCount(0);
  await empty(page);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await empty(page);
}
test("top search opens unowned game details without adding it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search games", exact: true }).fill("browse");
  await page.getByRole("option", { name: /Browse Quest/ }).click();
  await expect(page).toHaveURL(/\/game\/10001$/);
  await expect(
    page.getByRole("button", { name: "Add to library & log", exact: true })
  ).toBeVisible();
  await empty(page);
});
test("keyboard search selection and catalog covers only browse", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search games", exact: true });
  await search.fill("browse");
  await expect(page.getByRole("option", { name: /Browse Quest/ })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/(game\/10001|search\?q=browse)$/);
  await empty(page);
  await page.goto("/search?q=browse");
  await page.getByRole("button", { name: "Browse Quest", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/10001$/);
  await empty(page);
});
test("related titles and system covers only browse", async ({ page }) => {
  await page.goto("/game/10002/related?tab=series");
  await page.getByRole("button", { name: "Browse Quest", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/10001$/);
  await empty(page);
  await page.goto("/systems/167?name=PlayStation%205");
  await page.getByRole("button", { name: "Browse Quest", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/10001$/);
  await empty(page);
});
test("game detail add-and-log remains a draft through Cancel and Escape", async ({ page }) => {
  await page.goto("/game/10001");
  const add = page.getByRole("button", { name: "Add to library & log", exact: true });
  await add.click();
  await cancelDraft(page);
  await add.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await empty(page);
});
test("picker titles preview and picker Add waits for Save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  await page.getByRole("textbox", { name: "Search games to add", exact: true }).fill("browse");
  await page.getByRole("button", { name: "View Browse Quest", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/10001$/);
  await empty(page);
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  await page.getByRole("textbox", { name: "Search games to add", exact: true }).fill("browse");
  await page.getByRole("button", { name: "Add Browse Quest", exact: true }).click();
  await cancelDraft(page);
});
for (const source of ["catalog", "system"])
  test(`${source} log action does not save until Save`, async ({ page }) => {
    await page.goto(
      source === "catalog" ? "/search?q=browse" : "/systems/167?name=PlayStation%205"
    );
    await page.getByRole("button", { name: "Actions for Browse Quest", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit game log", exact: true }).click();
    await cancelDraft(page);
    await page.getByRole("button", { name: "Actions for Browse Quest", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit game log", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = await library(page);
    expect(saved.games).toHaveLength(1);
    expect(saved.logs).toHaveLength(1);
    if (source === "system") expect(saved.logs[0].platforms).toEqual(["PlayStation 5"]);
  });
test("AI quick-log fields remain unsaved until the reviewed Save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  const quick = page.getByRole("textbox", { name: "Quick log", exact: true });
  await quick.fill("Browse Quest, played, 4.5 stars on PC");
  await quick.press("Enter");
  await page.getByRole("button", { name: "Add Browse Quest", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Not in your library yet");
  await empty(page);
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await library(page);
  expect(saved.games).toHaveLength(1);
  expect(saved.logs[0]).toMatchObject({ status: "Played", rating: 4.5, platforms: ["PC"] });
});
