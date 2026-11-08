import { test, expect } from "@playwright/test";
test.skip(
  process.env.GAMELOG_TEST_PRODUCTION !== "1",
  "Production asset recovery needs a built app"
);
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
test("startup defers optional pages and a failed page chunk leaves navigation usable", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".js")) requested.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  expect(
    requested.some((url) => /\/(StatsScreen|Settings|ActivityScreen|SystemsScreen)-/.test(url))
  ).toBe(false);
  await page.route(/\/assets\/StatsScreen-[^/]+\.js$/, (route) => route.abort());
  await page.getByRole("link", { name: "Statistics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This view could not be loaded", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload app", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Lists", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();
  await expect(page.getByText("This view could not be loaded", { exact: true })).toHaveCount(0);
});
test("first-load dialogs remain dismissible if their production chunk fails", async ({ page }) => {
  await page.route(/\/assets\/AddGameModal-[^/]+\.js$/, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Add game to library", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add game", exact: true });
  await expect(
    dialog.getByRole("heading", { name: "This view could not be loaded", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
});
