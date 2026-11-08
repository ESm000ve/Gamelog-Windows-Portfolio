import { test, expect, type Page } from "@playwright/test";
const raw = (id = 9301) => ({
  id,
  name: id === 9301 ? "Mountain Quest" : `Other Quest ${id}`,
  slug: `quest-${id}`,
  summary: "A useful description. ".repeat(30),
  storyline: "Spoiler: the mountain is alive.",
  first_release_date: 1577880000,
  rating: 0,
  rating_count: 10,
  genres: [{ name: "Adventure" }],
  platforms: [{ name: "PC" }, { name: "Nintendo Switch" }],
  game_modes: [{ name: "Single player" }],
  involved_companies: [{ company: { name: "Test Studio" }, developer: true }],
  screenshots: [{ image_id: "image1" }, { image_id: "image2" }],
  videos: [{ video_id: "abcdefghijk", name: "Trailer" }],
  websites: [
    { category: 1, url: "https://example.com/game" },
    { category: 1, url: "javascript:alert(1)" },
  ],
  similar_games: [{ id: 9302, name: "Other Quest 9302", slug: "other" }],
  ...(id === 9301
    ? {
        dlcs: [{ id: 9303, name: "DLC Quest", slug: "dlc" }],
        collections: [
          { name: "Quest series", games: [{ id: 9304, name: "Series Quest", slug: "series" }] },
        ],
      }
    : {}),
});
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 9301,
      title: "Mountain Quest",
      slug: "mountain",
      developer: "Test Studio",
      releaseYear: 2020,
      genres: ["Adventure"],
      platforms: ["PC", "Nintendo Switch"],
      addedAt: 1,
      updatedAt: 1,
    },
  ],
  logs: [
    {
      igdbId: 9301,
      status: "Playing",
      completion: "Abandoned",
      timePlayed: 0,
      completionPercentage: 0,
      notes: "Keep my personal notes.",
      playSessions: [{ date: "2026-10-27", durationMinutes: 60 }, { date: "2026-10-28" }],
      ownership: ["Digital"],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T12:00:00Z"));
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/detail"))
      return route.fulfill({
        json: {
          game: raw(Number(url.searchParams.get("id"))),
          timeToBeat: { average: 3, finish: 5, master: 10 },
        },
      });
    return route.fulfill({ json: url.pathname.endsWith("/platforms") ? { platforms: [] } : [] });
  });
  await page.route("https://images.igdb.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lX8AAAAASUVORK5CYII=",
        "base64"
      ),
    })
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>Video preview</p>" })
  );
});
async function seed(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "detail.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
}
test("personal log stays prominent, separates recorded values, and keeps spoilers collapsed", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/game/9301");
  await expect(page.getByRole("heading", { name: "Mountain Quest", level: 1 })).toBeVisible();
  const log = page.getByRole("region", { name: "Your log", exact: true });
  await expect(log).toContainText("0h");
  await expect(log).toContainText("0%");
  await expect(log).toContainText("1h in dated sessions");
  await expect(log).toContainText("Not recorded");
  await expect(log).not.toContainText("Abandoned");
  const edit = (await page.getByRole("button", { name: "Edit log", exact: true }).boundingBox())!;
  expect(edit.y).toBeLessThan(200);
  await expect(page.getByText("Spoiler: the mountain is alive.", { exact: true })).toBeHidden();
  await page.getByText("Storyline (may contain spoilers)", { exact: true }).click();
  await expect(page.getByText("Spoiler: the mountain is alive.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read more description", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show less description", exact: true })
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByText("More log details", { exact: true }).click();
  await expect(log).toContainText("Digital");
  await expect(page.getByRole("region", { name: "Game overview", exact: true })).toContainText(
    "0 / 100"
  );
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
});
test("media supports keyboard, next/previous, Escape, focus return, and explicit video loading", async ({
  page,
}) => {
  await page.goto("/game/9301");
  await expect(page.getByRole("button", { name: "Open Screenshot 1", exact: true })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Open Screenshot 1", exact: true });
  await trigger.press("Enter");
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Screenshot 1");
  await dialog.getByRole("button", { name: "Next media", exact: true }).click();
  await expect(dialog).toContainText("Screenshot 2");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Open Trailer", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/abcdefghijk"
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("iframe")).toHaveCount(0);
});
test("related pages honor deep-linked categories and detail navigation resets stale selection", async ({
  page,
}) => {
  await page.goto("/game/9301/related?tab=series");
  await expect(page.getByRole("tab", { name: /^Series \(/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("button", { name: "Series Quest", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to game", exact: true }).click();
  await page.getByRole("tab", { name: /^DLC \(/ }).click();
  await page.getByRole("button", { name: "DLC Quest", exact: true }).click();
  await expect(page).toHaveURL(/game\/9303$/);
  await expect(page.getByRole("tab", { name: /^Related \(/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
test("saved log is available during slow online loading and survives refresh failure", async ({
  page,
}) => {
  await seed(page);
  let finish: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/igdb/detail?*", async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: {} }).catch(() => {});
  });
  await page.goto("/game/9301");
  await expect(page.getByText("Keep my personal notes.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Updating online details. Your saved log is available below.", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Session history", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Session history: Mountain Quest", exact: true })
  ).toBeVisible();
  finish();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Retry online details", exact: true })
  ).toBeVisible();
});
test("compact details fit and direct invalid links have a useful recovery path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 575, height: 850 });
  await seed(page);
  await page.goto("/game/9301");
  await expect(page.getByRole("button", { name: "Edit log", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(575);
  await page.goto("/game/9301bad");
  await expect(page.getByRole("heading", { name: "Game not found", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Go to library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
});

test("editor and list creation remain usable, and failed list writes retain the draft", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/game/9301");
  await page.getByRole("button", { name: "Edit log", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit game log", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "New list", exact: true }).click();
  await dialog.getByPlaceholder("List name").fill("Next adventures");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      if (this.name === "lists") {
        IDBObjectStore.prototype.add = original;
        throw new Error("Simulated list write failure");
      }
      return original.apply(this, args);
    };
  });
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Simulated list write failure");
  await expect(dialog.getByPlaceholder("List name")).toHaveValue("Next adventures");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Next adventures/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
test("catalog game addition stays a draft until Save creates the personal record", async ({
  page,
}) => {
  await page.goto("/game/9302");
  await page.getByRole("button", { name: "Add to library & log", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit game log", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Add to library & log", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Your log", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add to library & log", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Edit game log", exact: true })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit log", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your log", exact: true })).toContainText(
    "Backlog"
  );
  await page.reload();
  await expect(page.getByRole("region", { name: "Your log", exact: true })).toContainText(
    "Backlog"
  );
});
