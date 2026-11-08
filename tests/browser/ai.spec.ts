import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 101,
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
      igdbId: 102,
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
      igdbId: 103,
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
    { igdbId: 101, status: "Backlog", notes: "Private test note", createdAt: 1, updatedAt: 1 },
    { igdbId: 102, status: "Backlog", createdAt: 1, updatedAt: 1 },
    { igdbId: 103, status: "Wishlist", createdAt: 1, updatedAt: 1 },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
async function seed(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "ai-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.goto("/settings#recently-removed");
}
test("recommendations start locally, respect source and hour limits, and explain AI failure", async ({
  page,
}) => {
  await seed(page);
  let calls = 0;
  await page.route("**/api/ai/recommend", (route) => {
    calls++;
    expect(route.request().postData()).not.toContain("Private test note");
    return route.fulfill({ status: 429, json: { error: "AI usage limit reached." } });
  });
  await page.goto("/recommend");
  await expect(page.getByRole("heading", { name: "Short Quest", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Long Quest", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wishlist Quest", exact: true })).toHaveCount(0);
  expect(calls).toBe(0);
  await page.getByRole("combobox", { name: "Maximum story length" }).selectOption("5");
  await expect(page.getByRole("heading", { name: "Long Quest", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Refine with AI", exact: true }).click();
  await expect(page.getByText(/AI usage limit reached.*Showing local picks/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Short Quest", exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("combobox", { name: "Play pool", exact: true }).selectOption("playing");
  await expect(page.getByRole("heading", { name: "Wishlist Quest", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No games in this play pool", exact: true })
  ).toBeVisible();
});
test("changing constraints cancels an earlier AI refinement without stale picks", async ({
  page,
}) => {
  await seed(page);
  let release: () => void = () => {};
  let started: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    pending = new Promise<void>((resolve) => {
      started = resolve;
    });
  await page.route("**/api/ai/recommend", async (route) => {
    started();
    await gate;
    await route.fulfill({ json: { picks: [{ id: 102, reason: "Old request" }] } }).catch(() => {});
  });
  await page.goto("/recommend");
  await expect(page.getByRole("heading", { name: "Short Quest", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refine with AI", exact: true }).click();
  await pending;
  await page.getByRole("combobox", { name: "Maximum story length" }).selectOption("5");
  await expect(page.getByRole("heading", { name: "Short Quest", exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Long Quest", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refine with AI", exact: true })).toBeEnabled();
});
test("quick-log fields remain a visible draft and clear when the title changes", async ({
  page,
}) => {
  await page.route("**/api/ai/parse-log", (route) =>
    route.fulfill({ json: { title: "Hades", logFields: { status: "Played", rating: 4.5 } } })
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  const quick = page.getByRole("textbox", { name: "Quick log", exact: true });
  await quick.fill("Hades 4.5 stars, finished");
  await quick.press("Enter");
  await expect(page.getByText(/Draft for Hades:/)).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search games to add", exact: true })
    .fill("Different game");
  await expect(page.getByText(/Draft for Hades:/)).toHaveCount(0);
});
test("malformed quick-log output shows an error while manual search remains usable", async ({
  page,
}) => {
  await page.route("**/api/ai/parse-log", (route) =>
    route.fulfill({ json: { title: "Hades", logFields: { rating: 50 } } })
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add game to library", exact: true }).click();
  const quick = page.getByRole("textbox", { name: "Quick log", exact: true });
  await quick.fill("Hades 4.5 stars");
  await quick.press("Enter");
  await expect(page.getByText(/AI returned an invalid response/)).toBeVisible();
  await page.getByRole("textbox", { name: "Search games to add", exact: true }).fill("Hades");
  await expect(page.getByRole("textbox", { name: "Search games to add", exact: true })).toHaveValue(
    "Hades"
  );
});
test("sparse taste observations use local guidance without a provider request", async ({
  page,
}) => {
  await seed(page);
  let calls = 0;
  await page.route("**/api/ai/taste-insights", (route) => {
    calls++;
    return route.fulfill({ json: { insights: [] } });
  });
  await page.goto("/stats");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByText("Rate at least three games to get useful taste observations.", { exact: true })
  ).toBeVisible();
  expect(calls).toBe(0);
});
test("game matching starts only on request and Stop leaves the UI usable", async ({ page }) => {
  await seed(page);
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ai/embed", async (route) => {
    calls++;
    await gate;
    await route
      .fulfill({ json: { embedding: [1, 2], model: "gemini-embedding-001" } })
      .catch(() => {});
  });
  await page.goto("/recommend");
  await expect(page.getByRole("heading", { name: "Short Quest", exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Prepare game matches", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  release();
  await expect(
    page.getByText("Stopped. Completed game matches were kept.", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare game matches", exact: true })
  ).toBeEnabled();
});

test("recommendation action buttons work independently with the keyboard", async ({ page }) => {
  await seed(page);
  await page.goto("/recommend");
  const card = page.getByRole("group", { name: "Recommendation: Short Quest", exact: true });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Mark as playing", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/game\/101$/);
  await page.goto("/recommend");
  await expect(page.getByRole("heading", { name: "Long Quest", exact: true })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Recommendation: Short Quest", exact: true })
  ).toContainText("Playing");
});
