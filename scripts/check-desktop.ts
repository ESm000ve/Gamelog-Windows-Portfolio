import assert from "node:assert/strict";
import { createRequire, isBuiltin } from "node:module";
import { readFile, stat, mkdtemp, rmdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import vm from "node:vm";
import ts from "typescript";

// Exercise the compiled desktop bootstrap and real HTTP server without opening
// a native window, loading user credentials, or allowing external packages.
const bundle = path.resolve(process.argv[2] ?? ".", "dist-electron/main.js");
const source = await readFile(bundle, "utf8");
const nativeRequire = createRequire(import.meta.url);
const probe = createServer();
await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((resolve, reject) =>
  probe.close((error) => (error ? reject(error) : resolve()))
);
const smokeHome = await mkdtemp(path.join(tmpdir(), ".gamelog-build-check-"));
const servers: Server[] = [];
let windowOptions: Record<string, unknown> | undefined;
let finish!: (url: string) => void;
let fail!: (error: Error) => void;
const loaded = new Promise<string>((resolve, reject) => {
  finish = resolve;
  fail = reject;
});
const app = {
  getPath: () => smokeHome,
  requestSingleInstanceLock: () => true,
  whenReady: () => Promise.resolve(),
  on() {},
  quit() {},
};
class WindowStub {
  constructor(options: Record<string, unknown>) {
    windowOptions = options;
  }
  setMenuBarVisibility() {}
  setBackgroundColor() {}
  loadURL(url: string) {
    finish(url);
    return Promise.resolve();
  }
}
const electron = {
  app,
  BrowserWindow: WindowStub,
  ipcMain: { on() {} },
  nativeTheme: { shouldUseDarkColors: false, on() {} },
  dialog: {
    showErrorBox: (title: string, message: string) => fail(new Error(title + ": " + message)),
  },
};
const imported = new Set<string>();
function runtimeRequire(id: string): unknown {
  imported.add(id);
  if (id === "electron") return electron;
  assert.ok(isBuiltin(id), "Desktop unexpectedly needs an unpackaged dependency: " + id);
  if (id === "node:module" || id === "module")
    return { ...nativeRequire(id), createRequire: () => runtimeRequire };
  if (id === "node:http" || id === "http") {
    const http = nativeRequire(id) as typeof import("node:http");
    return {
      ...http,
      createServer: (...args: Parameters<typeof http.createServer>) => {
        const server = http.createServer(...args);
        servers.push(server);
        return server;
      },
    };
  }
  return nativeRequire(id);
}
const code = ts.transpileModule(
  source.replaceAll("import.meta.url", JSON.stringify(pathToFileURL(bundle).href)),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }
).outputText;
const timeout = setTimeout(() => fail(new Error("Desktop bootstrap timed out")), 10000);
try {
  vm.runInNewContext(
    code,
    {
      exports: {},
      require: runtimeRequire,
      console,
      Buffer,
      URL,
      URLSearchParams,
      TextDecoder,
      TextEncoder,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      process: {
        ...process,
        env: { GAMELOG_PORT: String(port), NODE_ENV: "production" },
        cwd: () => smokeHome,
      },
      fetch: () => {
        throw new Error("Unexpected upstream network request during desktop smoke check");
      },
    },
    { filename: bundle }
  );
  const url = await loaded;
  const preferences = windowOptions?.webPreferences as Record<string, unknown>;
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.ok((await stat(String(preferences.preload))).isFile());
  const html = await fetch(url + "/game/42", { signal: AbortSignal.timeout(3000) });
  assert.equal(html.status, 200);
  assert.match(await html.text(), /id="root"/);
  assert.equal((await fetch(url + "/api/unknown")).status, 404);
  assert.equal((await fetch(url + "/api/igdb/detail?id=invalid")).status, 400);
  assert.equal(
    (
      await fetch(url + "/api/ai/parse-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "short games" }),
      })
    ).status,
    503
  );
  console.log(
    "Compiled desktop bootstrap, isolated HTTP routes and preload passed using only Node/Electron runtime imports."
  );
  console.log(JSON.stringify({ runtimeImports: [...imported].sort() }));
} finally {
  clearTimeout(timeout);
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );
  await rmdir(smokeHome);
}
