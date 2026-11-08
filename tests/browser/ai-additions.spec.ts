import { test, expect, type Page } from "@playwright/test";
const originalNotes = "Reached the old bridge.\nNext: find Mira near the inn.";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 201,
      title: "Short Quest",
      slug: "short-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["RPG"],
      platforms: ["PC"],
      timeToBeat: { finish: 3 },
      addedAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 202,
      title: "Long Quest",
      slug: "long-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["RPG"],
      platforms: ["PC"],
      timeToBeat: { finish: 50 },
      addedAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 203,
      title: "Puzzle Quest",
      slug: "puzzle-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["Puzzle"],
      platforms: ["PC"],
      timeToBeat: { finish: 2 },
      addedAt: 1,
      updatedAt: 1,
    },
    {
      igdbId: 204,
      title: "Wishlist Quest",
      slug: "wishlist-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: ["RPG"],
      platforms: ["PC"],
      timeToBeat: { finish: 2 },
      addedAt: 1,
      updatedAt: 1,
    },
  ],
  logs: [
    { igdbId: 201, status: "Backlog", notes: originalNotes, createdAt: 1, updatedAt: 1 },
    { igdbId: 202, status: "Backlog", createdAt: 1, updatedAt: 1 },
    { igdbId: 203, status: "Backlog", createdAt: 1, updatedAt: 1 },
    { igdbId: 204, status: "Wishlist", createdAt: 1, updatedAt: 1 },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
  await page.route("**/api/igdb/detail?*", (route) => {
    const id = Number(new URL(route.request().url()).searchParams.get("id"));
    const game = fixture.games.find((game) => game.igdbId === id)!;
    return route.fulfill({
      json: {
        game: {
          id,
          name: game.title,
          slug: game.slug,
          genres: game.genres.map((name) => ({ name })),
          platforms: game.platforms.map((name) => ({ name })),
          involved_companies: [],
        },
      },
    });
  });
});
async function seed(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "feature-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/settings#recently-removed");
}
async function finder(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask library", exact: true }).click();
  return page.getByRole("dialog", { name: "Ask your library", exact: true });
}
async function recap(page: Page) {
  await page.goto("/game/201");
  await page.getByRole("button", { name: /^(Resume recap|View resume recap)$/ }).click();
  return page.getByRole("dialog", { name: "Resume recap: Short Quest", exact: true });
}
test("finder previews editable filters and applies only after review", async ({ page }) => {
  await seed(page);
  await page.route("**/api/ai/parse-search", (route) => {
    expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(["query", "scope"]);
    return route.fulfill({
      json: {
        target: "library",
        igdbSearchQuery: "",
        filters: { status: "Backlog", genres: ["RPG"], maxTime: 10 },
      },
    });
  });
  const dialog = await finder(page);
  await dialog
    .getByRole("textbox", { name: "Library request" })
    .fill("My backlog RPGs under ten hours");
  await dialog.getByRole("button", { name: "Interpret request" }).click();
  await expect(dialog.getByRole("heading", { name: "1 matching game", exact: true })).toBeVisible();
  await expect(dialog.getByText("Short Quest", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Long Quest", { exact: true })).toHaveCount(0);
  await dialog.getByRole("spinbutton", { name: "Maximum story hours", exact: true }).fill("60");
  await expect(
    dialog.getByRole("heading", { name: "2 matching games", exact: true })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Long Quest", exact: true, level: 3 })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Wishlist Quest", exact: true, level: 3 })
  ).toHaveCount(0);
});
test("finder offers honest local fallback and Escape restores the trigger", async ({ page }) => {
  await seed(page);
  await page.route("**/api/ai/parse-search", (route) =>
    route.fulfill({ status: 429, json: { error: "AI usage limit reached." } })
  );
  const dialog = await finder(page);
  await dialog
    .getByRole("textbox", { name: "Library request" })
    .fill("Backlog RPGs under five hours");
  await dialog.getByRole("button", { name: "Interpret request" }).click();
  await expect(dialog.getByText(/Local draft shown/)).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "1 matching game", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Ask library", exact: true })).toBeFocused();
});
test("a reviewed list stores only checked matching games and survives reload", async ({ page }) => {
  await seed(page);
  await page.route("**/api/ai/parse-search", (route) =>
    route.fulfill({
      json: { target: "library", igdbSearchQuery: "", filters: { status: "Backlog", maxTime: 10 } },
    })
  );
  await page.goto("/lists");
  await page.getByRole("button", { name: "Draft a list", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Draft a list", exact: true });
  await dialog
    .getByRole("textbox", { name: "Library request" })
    .fill("Weekend shortlist from my backlog");
  await dialog.getByRole("button", { name: "Interpret request" }).click();
  await expect(
    dialog.getByRole("heading", { name: "2 matching games", exact: true })
  ).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Include Puzzle Quest", exact: true }).uncheck();
  await dialog.getByRole("textbox", { name: "Draft list name", exact: true }).fill("My weekend");
  await dialog.getByRole("button", { name: "Create list (1)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My weekend", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Open Short Quest", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Puzzle Quest", exact: true })).toHaveCount(0);
});
test("cancelling a list draft creates nothing", async ({ page }) => {
  await seed(page);
  await page.goto("/lists");
  await page.getByRole("button", { name: "Draft a list", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Draft a list", exact: true });
  await dialog.getByRole("button", { name: "Choose filters manually", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "3 matching games", exact: true })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No lists yet", exact: true })).toBeVisible();
});
test("recap consent resets on edits, cites selected sources, and saves separately", async ({
  page,
}) => {
  await seed(page);
  let calls = 0;
  await page.route("**/api/ai/resume-recap", (route) => {
    calls++;
    const payload = route.request().postDataJSON();
    expect(payload.consent).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("old bridge");
    expect(Object.keys(payload).sort()).toEqual(["consent", "sources", "title"]);
    return route.fulfill({
      json: { bullets: [{ text: "Find Mira near the inn.", sourceIds: [1] }] },
    });
  });
  let dialog = await recap(page);
  const generate = dialog.getByRole("button", { name: "Generate recap", exact: true });
  const consent = dialog.getByRole("checkbox", {
    name: "Allow selected excerpts to be sent to Gemini",
    exact: true,
  });
  await expect(generate).toBeDisabled();
  expect(calls).toBe(0);
  await consent.check();
  await dialog
    .getByRole("textbox", { name: "Selected note excerpts", exact: true })
    .fill("Next: find Mira near the inn.");
  await expect(consent).not.toBeChecked();
  await expect(generate).toBeDisabled();
  await consent.check();
  await generate.click();
  await expect(dialog.getByRole("region", { name: "Recap draft", exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "[Source 1]", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save recap", exact: true }).click();
  await expect(
    dialog.getByText("Recap saved separately. Your original notes were not changed.", {
      exact: true,
    })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText(originalNotes, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "View resume recap", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Resume recap: Short Quest", exact: true });
  await expect(dialog.getByRole("region", { name: "Saved recap", exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", {
      name: "Allow selected excerpts to be sent to Gemini",
      exact: true,
    })
  ).not.toBeChecked();
  expect(calls).toBe(1);
});
test("uncited recap output is rejected without offering Save", async ({ page }) => {
  await seed(page);
  await page.route("**/api/ai/resume-recap", (route) =>
    route.fulfill({ json: { bullets: [{ text: "Unsupported event", sourceIds: [99] }] } })
  );
  const dialog = await recap(page);
  await dialog
    .getByRole("checkbox", { name: "Allow selected excerpts to be sent to Gemini", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Generate recap", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("uncited recap");
  await expect(dialog.getByRole("button", { name: "Save recap", exact: true })).toHaveCount(0);
});
test("closing a pending recap cancels the request and leaves no saved recap", async ({ page }) => {
  await seed(page);
  let release: () => void = () => {},
    started: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    pending = new Promise<void>((resolve) => {
      started = resolve;
    });
  await page.route("**/api/ai/resume-recap", async (route) => {
    started();
    await gate;
    await route
      .fulfill({ json: { bullets: [{ text: "Reached the old bridge.", sourceIds: [1] }] } })
      .catch(() => {});
  });
  const dialog = await recap(page);
  await dialog
    .getByRole("checkbox", { name: "Allow selected excerpts to be sent to Gemini", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Generate recap", exact: true }).click();
  await pending;
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  release();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume recap", exact: true })).toBeVisible();
  await expect(page.getByText(originalNotes, { exact: true })).toBeVisible();
});
