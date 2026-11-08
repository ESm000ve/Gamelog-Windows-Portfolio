import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createServerApp } from "../server/app.ts";
import { portfolioFixture } from "./portfolio-fixture.ts";

await mkdir("docs/screenshots", { recursive: true });
await mkdir("examples", { recursive: true });
await writeFile("examples/demo-library.json", JSON.stringify(portfolioFixture, null, 2) + "\n");
const server = createServerApp("dist").listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing screenshot server");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined),
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
  await page.route("https://www.cheapshark.com/**", (route) => route.fulfill({ json: [] }));
  const base = `http://127.0.0.1:${address.port}`;
  await page.goto(`${base}/settings`);
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.locator('input[type="file"]').first().setInputFiles("examples/demo-library.json");
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await expect(page.getByText("Import completed successfully!", { exact: true })).toBeVisible();
  for (const [route, name, heading] of [
    ["/", "library-light", "Library"],
    ["/recommend", "what-to-play", "What to play"],
    ["/stats", "statistics", "Statistics"],
    ["/lists", "collections", "Lists"],
  ]) {
    await page.goto(base + route);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".skeleton")).toHaveCount(0);
    await page.screenshot({ path: `docs/screenshots/${name}.png`, animations: "disabled" });
  }
  await page.goto(`${base}/settings`);
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "docs/screenshots/library-dark.png", animations: "disabled" });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Captured five production-app screenshots with fictional data and no provider requests."
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
