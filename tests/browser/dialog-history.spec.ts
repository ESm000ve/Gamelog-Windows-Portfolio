import { test, expect, type Page } from "@playwright/test";
const source = "/game/9901/related?tab=series&q=quest";
const raw = (id: number) => ({
  id,
  name: id === 9901 ? "Source Quest" : id === 9902 ? "Target Quest" : "Picker Quest",
  slug: `quest-${id}`,
  genres: [{ name: "Adventure" }],
  platforms: [{ name: "PC" }],
  ...(id === 9901
    ? {
        collections: [
          {
            name: "Quest",
            slug: "quest",
            games: [{ id: 9902, name: "Target Quest", slug: "target" }],
          },
        ],
      }
    : {}),
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: url.pathname.endsWith("/detail")
        ? { game: raw(Number(url.searchParams.get("id"))), timeToBeat: null }
        : url.pathname.endsWith("/search")
          ? [raw(9903)]
          : url.pathname.endsWith("/platforms")
            ? { platforms: [] }
            : [],
    });
  });
});
async function openTarget(page: Page) {
  await page.goto(source);
  await page.getByRole("button", { name: "Target Quest", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/9902$/);
  return page.evaluate(() => window.history.state.idx as number);
}
async function save(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Edit game log", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&](log|add-game|add-to-list)=/);
}
async function backAndForward(page: Page, index: number) {
  expect(await page.evaluate(() => window.history.state.idx)).toBe(index);
  // Browser history traversal is the same path used by mouse Back and Alt+Left.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(source.replace(/[?]/g, "\\?")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Search related games", { exact: true })).toHaveValue("quest");
  await page.goForward();
  await expect(page).toHaveURL(/\/game\/9902$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("saving a newly added game leaves one Back step to the originating screen", async ({
  page,
}) => {
  const index = await openTarget(page);
  await page.getByRole("button", { name: "Add to library & log", exact: true }).click();
  await save(page);
  await expect(page.getByRole("button", { name: "Edit log", exact: true })).toBeVisible();
  await backAndForward(page, index);
});
test("editing, cancelling and closing list dialogs never resurrect completed forms", async ({
  page,
}) => {
  const index = await openTarget(page);
  await page.getByRole("button", { name: "Add to library & log", exact: true }).click();
  await save(page);
  await page.getByRole("button", { name: "Edit log", exact: true }).click();
  await save(page);
  await page.getByRole("button", { name: "Edit log", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Edit game log", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await backAndForward(page, index);
});
test("add picker to save editor replaces the same history entry", async ({ page }) => {
  const index = await openTarget(page);
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add game", exact: true });
  await picker.getByRole("textbox", { name: "Search games to add", exact: true }).fill("picker");
  await picker.getByRole("button", { name: "Add Picker Quest", exact: true }).click();
  await save(page);
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add game", exact: true })
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await backAndForward(page, index);
});
