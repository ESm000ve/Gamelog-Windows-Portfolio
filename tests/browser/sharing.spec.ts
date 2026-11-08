import { test, expect, type Page } from "@playwright/test";
const fixture = {
  version: 2,
  games: [
    {
      igdbId: 901,
      title: "Sharing Quest",
      slug: "sharing-quest",
      developer: "Test",
      releaseYear: 2024,
      genres: [],
      platforms: ["PS5"],
      addedAt: 1,
      updatedAt: 1,
    },
  ],
  logs: [
    {
      igdbId: 901,
      status: "Played",
      completion: "Abandoned",
      platforms: ["PC"],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  lists: [],
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
});
async function share(page: Page) {
  await page.goto("/settings");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "sharing.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Share & Export Library", exact: true }).click();
  return page.getByRole("dialog", { name: "Share and export: My Game Library", exact: true });
}
test("sharing has keyboard tabs, truthful exports, clipboard recovery and calendar download", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let attempts = 0;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          if (++attempts === 1) throw new Error("Clipboard permission denied");
        },
      },
      configurable: true,
    });
  });
  const dialog = await share(page);
  const text = dialog.getByRole("textbox", { name: "Markdown export" });
  await expect(text).toHaveValue(/- \[ \].*Abandoned.*PC/);
  await expect(text).not.toHaveValue(/PS5/);
  await dialog.getByRole("button", { name: "Copy Markdown Text", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Clipboard permission denied");
  await expect(dialog.getByText("Copied to clipboard.", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Copy Markdown Text", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Copied to clipboard.");
  await dialog.getByRole("tab", { name: "Markdown Text", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "Visual Card", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("tab", { name: "Visual Card", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(dialog.getByRole("img", { name: "Share card preview" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("sharing-windows.png") });
  await dialog.getByRole("tab", { name: "Calendar (.ics)", exact: true }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download Calendar (.ics)", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("my-game-library.ics");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("a failed share image stops, shows Retry and generates only when requested", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let attempts = 0;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (this.width === 800 && this.height === 520 && ++attempts === 1)
        throw new Error("Image generation unavailable");
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  const dialog = await share(page);
  await dialog.getByRole("tab", { name: "Visual Card", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Image generation unavailable");
  await expect(dialog.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("img", { name: "Share card preview" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Try generating again", exact: true }).click();
  await expect(dialog.getByRole("img", { name: "Share card preview" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
});

test("a delayed clipboard result cannot mark a different export format as copied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () =>
          new Promise<void>((resolve) =>
            window.addEventListener("audit:finish-copy", () => resolve(), { once: true })
          ),
      },
      configurable: true,
    });
  });
  const dialog = await share(page);
  await dialog.getByRole("button", { name: "Copy Markdown Text", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Copy Markdown Text", exact: true })
  ).toBeDisabled();
  await dialog.getByRole("tab", { name: "Visual Card", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("audit:finish-copy")));
  await expect(dialog.getByRole("button", { name: "Copy Image", exact: true })).toBeEnabled();
  await expect(dialog.getByText("Copied to clipboard.", { exact: true })).toHaveCount(0);
});
