import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServerApp } from "../server/app.ts";
const realFetch = globalThis.fetch;
test("production server serves routes and POST endpoints without consuming request bodies early", async () => {
  const upstream: string[] = [];
  globalThis.fetch = async (url) => {
    upstream.push(String(url));
    if (String(url).includes("oauth2")) return Response.json({ access_token: "test-token" });
    if (String(url).includes("generativelanguage"))
      return Response.json({
        embedding: { values: [1, 2, 3] },
        candidates: [
          {
            content: {
              parts: [{ text: '{"target":"igdb","igdbSearchQuery":"short","filters":{},"picks":[],"title":"Test","logFields":{},"insights":[]}' }],
            },
          },
        ],
      });
    if (String(url).includes("steampowered")) return Response.json({ response: { games: [] } });
    return Response.json([]);
  };
  const names = [
    "IGDB_CLIENT_ID",
    "IGDB_CLIENT_SECRET",
    "GEMINI_API_KEY",
    "VITE_GEMINI_API_KEY",
    "STEAM_WEB_API_KEY",
  ];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) process.env[name] = "test";
  // A hidden ancestor must not make Express reject the SPA fallback as a dotfile.
  const fixture = await mkdtemp(path.join(tmpdir(), ".gamelog-audit-"));
  await writeFile(path.join(fixture, "index.html"), '<div id="root"></div>');
  const server = createServerApp(fixture).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  const call = (route: string, init?: RequestInit) =>
    realFetch(base + route, { ...init, signal: AbortSignal.timeout(3000) });
  try {
    assert.equal((await call("/")).status, 200);
    assert.equal((await call("/game/42")).status, 200);
    assert.equal((await call("/api/unknown")).status, 404);
    for (const route of [
      "/api/igdb/fetch?id=1;bad",
      "/api/igdb/detail?id=x",
      "/api/igdb/search?q=test&limit=-1",
      "/api/igdb/bulk-fetch?ids=1,x",
      "/api/igdb/platform-games?platformId=x",
      "/api/steam/owned-games?steamId=bad",
    ])
      assert.equal((await call(route)).status, 400, route);
    assert.equal(upstream.length, 0);
    for (const [route, body] of [
      ["embed", { text: "Test" }],
      ["parse-search", { query: "short games" }],
      ["parse-log", { text: "Test", currentDate: "2026-10-26" }],
      ["recommend", { intent: "short", candidates: [] }],
      ["taste-insights", { totalGames: 0, totalRated:0 }],
    ] as const) {
      const response = await call("/api/ai/" + route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200, route);
      await response.json();
    }
    const match = await call("/api/igdb/match-steam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"appIds":[]}',
    });
    assert.deepEqual(await match.json(), {});
    assert.equal((await call("/api/ai/embed", { method: "POST", body: "{" })).status, 400);
    assert.equal((await call("/api/ai/embed")).status, 405);
    const search = await call("/api/igdb/search?q=test");
    assert.equal(search.status, 200);
    assert.deepEqual(await search.json(), []);
  } finally {
    globalThis.fetch = realFetch;
    for (const name of names) {
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    await unlink(path.join(fixture, "index.html"));
    await rmdir(fixture);
  }
});
