import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
  await page.route("**/api/igdb/search?*", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({
      json: [
        {
          id: q.toLowerCase().includes("celeste") ? 711002 : 711001,
          name: q,
          slug: "fixture",
          involved_companies: [],
        },
      ],
    });
  });
});
test("a second global search updates the current results page and Back/Forward queries", async ({
  page,
}) => {
  await page.goto("/search?q=Hades");
  await expect(page.getByRole("heading", { name: "Hades", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Search games", exact: true }).fill("Celeste");
  await page.getByRole("button", { name: "Search catalog", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=Celeste$/);
  await expect(page.getByRole("textbox", { name: "Bulk Catalog Search", exact: true })).toHaveValue(
    "Celeste"
  );
  await expect(page.getByRole("heading", { name: "Celeste", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hades", exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=Hades$/);
  await expect(page.getByRole("textbox", { name: "Bulk Catalog Search", exact: true })).toHaveValue(
    "Hades"
  );
  await expect(page.getByRole("heading", { name: "Hades", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Celeste", exact: true })).toBeVisible();
});
test("typed catalog edits preserve other parameters and a pending edit cannot overwrite a global search", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/search?q=Hades&keep=yes");
  const input = page.getByRole("textbox", { name: "Bulk Catalog Search", exact: true });
  await input.fill("Celeste");
  await expect(page).toHaveURL(/q=Celeste/);
  expect(new URL(page.url()).searchParams.get("keep")).toBe("yes");
  await expect(page.getByRole("heading", { name: "Celeste", exact: true })).toBeVisible();
  await input.fill("old pending edit");
  await page.getByRole("combobox", { name: "Search games", exact: true }).fill("Hades");
  await page.getByRole("button", { name: "Search catalog", exact: true }).click();
  await page.clock.fastForward(700);
  await expect(page).toHaveURL(/\/search\?q=Hades$/);
  await expect(input).toHaveValue("Hades");
  await expect(page.getByRole("heading", { name: "Hades", exact: true })).toBeVisible();
});
test("search submission and suggestions remain usable at desktop minimum width without saving games", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto("/");
  const submit = page.getByRole("button", { name: "Search catalog", exact: true });
  await expect(submit).toBeDisabled();
  await page.getByRole("combobox", { name: "Search games", exact: true }).fill("Celeste");
  await expect(page.getByRole("option", { name: /^Celeste/ })).toBeVisible();
  await submit.click();
  await expect(page.getByRole("heading", { name: "Celeste", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your library is empty", exact: true })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
