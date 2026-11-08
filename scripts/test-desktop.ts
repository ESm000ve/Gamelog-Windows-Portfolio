import assert from "node:assert/strict";
import { _electron as electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.resolve(process.argv[2] ?? ".");
const bundle = path.join(root, "dist-electron/main.js");
const showForDragCheck = process.argv.includes("--show");
const scratch = await mkdtemp(path.join(tmpdir(), "gamelog-desktop-test-"));
await mkdir(path.join(scratch, "profile"));
await writeFile(
  path.join(scratch, "profile", ".env"),
  "GEMINI_API_KEY=desktop-test-key\n"
);
const probe = createServer();
await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((resolve) => probe.close(() => resolve()));
const harness = path.join(scratch, "main.cjs");
await writeFile(
  harness,
  `
const electron = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const url = require("node:url");
const moduleAPI = require("node:module");
const ts = require(${JSON.stringify(require.resolve("typescript"))});
electron.app.setName("Gamelog Desktop Verification");
electron.app.setPath("userData", ${JSON.stringify(path.join(scratch, "profile"))});
class HiddenWindow extends electron.BrowserWindow {
  constructor(options) {
    super({ ...options, show: ${showForDragCheck} });
    globalThis.__gamelogNativeWindow = this;
    if (${showForDragCheck}) this.on("page-title-updated", (event) => { event.preventDefault(); this.setTitle("Gamelog drag verification"); });
  }
}
const facade = { ...electron, BrowserWindow: HiddenWindow };
const bundle = ${JSON.stringify(bundle)};
const baseRequire = moduleAPI.createRequire(url.pathToFileURL(bundle));
function runtimeRequire(id) {
  if (id === "electron") return facade;
  if (id === "node:module" || id === "module") return { ...moduleAPI, createRequire: () => runtimeRequire };
  return baseRequire(id);
}
const source = fs.readFileSync(bundle, "utf8").replaceAll("import.meta.url", JSON.stringify(url.pathToFileURL(bundle).href));
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const providerFetch = async (_url, options) => {
  if (options?.headers?.["x-goog-api-key"] !== "desktop-test-key") throw new Error("Private desktop key was not loaded");
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ target: "igdb", igdbSearchQuery: "short", filters: {} }) }] } }] }) };
};
vm.runInNewContext(code, { exports: {}, require: runtimeRequire, console, process, Buffer, URL, URLSearchParams, TextDecoder, TextEncoder, AbortSignal, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, fetch: providerFetch }, { filename: bundle });
`
);
let desktop: Awaited<ReturnType<typeof electron.launch>> | undefined;
try {
  desktop = await electron.launch({
    args: [harness],
    cwd: scratch,
    env: {
      ...process.env,
      GAMELOG_PORT: String(port),
      VITE_DEV_SERVER_URL: "",
      GEMINI_API_KEY: "",
    },
    timeout: 30000,
  });
  const page = await desktop.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/platforms") ? { platforms: [] } : [] })
  );
  await page.getByRole("heading", { name: "Library", exact: true }).waitFor();
  const dragRegions = await page.evaluate(() =>
    Object.fromEntries(
      [
        ".app-titlebar",
        ".app-titlebar-brand",
        ".app-titlebar-brand span",
        ".app-titlebar-search",
        ".app-titlebar-trailing",
        ".app-titlebar-search .fui-Combobox",
        ".app-titlebar-trailing button",
      ].map((selector) => [
        selector,
        getComputedStyle(document.querySelector(selector)!).getPropertyValue("-webkit-app-region"),
      ])
    )
  );
  for (const selector of [
    ".app-titlebar",
    ".app-titlebar-brand",
    ".app-titlebar-brand span",
    ".app-titlebar-search",
    ".app-titlebar-trailing",
  ])
    assert.equal(dragRegions[selector], "drag", selector + " must allow window dragging");
  for (const selector of [".app-titlebar-search .fui-Combobox", ".app-titlebar-trailing button"])
    assert.equal(dragRegions[selector], "no-drag", selector + " must remain interactive");
  const keyCheck = await page.request.post(new URL("/api/ai/parse-search", page.url()).href, {
    data: { query: "short games" },
  });
  assert.equal(
    keyCheck.status(),
    200,
    "Desktop must load its private .env before serving AI requests: " + (await keyCheck.text())
  );
  const bridge = await page.evaluate(
    () => (window as unknown as { desktop?: { platform: string; isElectron: boolean } }).desktop
  );
  assert.equal(bridge?.isElectron, true, "Real preload bridge must load");
  assert.equal(bridge?.platform, process.platform);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 243)");
  await expect(page.locator(".platform-provider").first()).toHaveCSS(
    "background-color",
    "rgb(243, 243, 243)"
  );
  await expect(page.locator("body")).toHaveCSS("color", "rgb(26, 26, 26)");
  await expect
    .poll(() => desktop!.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
    .toBe("light");
  await expect
    .poll(() =>
      desktop!.evaluate(() =>
        (
          globalThis as unknown as { __gamelogNativeWindow: { getBackgroundColor(): string } }
        ).__gamelogNativeWindow.getBackgroundColor()
      )
    )
    .toMatch(/^#(?:ff)?f3f3f3$/i);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Light", exact: true })).toBeChecked();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 243)");
  const fixture = {
    version: 2,
    games: [
      {
        igdbId: 901,
        title: "Desktop Verification Game",
        slug: "desktop-test",
        developer: "Test",
        releaseYear: 2024,
        firstReleaseDate: 1704067200,
        genres: [],
        platforms: ["PC"],
        addedAt: 1,
        updatedAt: 1,
      },
    ],
    logs: [
      {
        igdbId: 901,
        status: "Backlog",
        notes: "Isolated desktop test",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    lists: [],
    tags: [],
  };
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "desktop-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Merge (Add & Update)", exact: true }).click();
  await page.getByText("Import completed successfully!", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("heading", { name: "Desktop Verification Game", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Desktop Verification Game", exact: true }).waitFor();
  for (const [link, heading] of [
    ["Lists", "Lists"],
    ["Systems", "Systems"],
    ["Activity", "Activity"],
    ["Statistics", "Statistics"],
  ]) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await page.getByRole("heading", { name: heading, exact: true, level: 1 }).waitFor();
  }
  assert.deepEqual(errors, []);
  if (!showForDragCheck) {
    await desktop.close();
    desktop = await electron.launch({
      args: [harness],
      cwd: scratch,
      env: {
        ...process.env,
        GAMELOG_PORT: String(port),
        VITE_DEV_SERVER_URL: "",
        GEMINI_API_KEY: "",
      },
      timeout: 30000,
    });
    const reopened = await desktop.firstWindow();
    await reopened
      .getByRole("heading", { name: "Desktop Verification Game", exact: true })
      .waitFor();
    await expect(reopened.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(reopened.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 243)");
    await expect
      .poll(() => desktop!.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
      .toBe("light");
    console.log("Full native process restart preserved the saved library and light theme.");
  }
  if (showForDragCheck) {
    console.log(
      "Ready for native drag verification; close only the verification window when finished."
    );
    await new Promise<void>((resolve) => desktop!.on("close", () => resolve()));
    desktop = undefined;
  }
  console.log(
    "Native desktop passed: real preload/Windows bridge, drag/control regions, private key loading over an empty launcher variable, HTTP assets, backup import, persistence, and lazy navigation. Only an isolated temporary profile was used."
  );
} finally {
  await desktop?.close();
  // scratch is generated by mkdtemp under the OS temp folder, never user storage.
  assert.ok(scratch.startsWith(path.join(tmpdir(), "gamelog-desktop-test-")));
  await rm(scratch, { recursive: true, force: true });
}
