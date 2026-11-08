import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { attachIgdbRoutes } from "../server/igdb.ts";
const realFetch = globalThis.fetch;
test("system catalog API filters full upstream pages, normalizes current types, and validates POST library lists", async () => {
  const names = ["IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"];
  const old = names.map((name) => process.env[name]);
  names.forEach((name) => (process.env[name] = "test"));
  const bodies: string[] = [];
  let typeCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("oauth2")) return Response.json({ access_token: "catalog-test" });
    if (String(url).endsWith("game_types")) {
      typeCalls++;
      return Response.json([
        { id: 0, type: "Main Game" },
        { id: 108, type: "Remake" },
      ]);
    }
    bodies.push(String(init?.body));
    return Response.json([
      {
        id: 42,
        name: "Final Fantasy VII Remake",
        slug: "remake",
        game_type: { id: 108, type: "Remake" },
        first_release_date: 1,
        release_dates: [{ platform: 167, date: 1609459200 }],
      },
    ]);
  };
  const app = express();
  attachIgdbRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/igdb/platform-games`;
  const call = (query: string, init?: RequestInit) =>
    realFetch(base + query, { ...init, signal: AbortSignal.timeout(3000) });
  try {
    const response = await call("?platformId=167&type=versions&q=fantasy+remake+7");
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.games[0].category, 8);
    assert.equal(data.games[0].releaseYear, 2021);
    assert.match(bodies[0], /game_type = \(108\)/);
    assert.match(bodies[0], / VII /);
    const scoped = await call("?platformId=167&library=in&offset=50", {
      method: "POST",
      body: JSON.stringify({ ids: [42, 42, 51] }),
    });
    assert.equal(scoped.status, 200);
    assert.match(bodies[1], /id = \(42,51\)/);
    assert.match(bodies[1], /offset 50;/);
    assert.equal(typeCalls, 1);
    const count = bodies.length;
    assert.equal((await call("?platformId=167&library=in")).status, 400);
    assert.equal(
      (await call("?platformId=167", { method: "POST", body: JSON.stringify({ ids: ["42;bad"] }) }))
        .status,
      400
    );
    assert.equal((await call("?platformId=167", { method: "POST", body: "{" })).status, 400);
    assert.equal((await call("?platformId=167&type=invalid")).status, 400);
    assert.equal((await call("?platformId=167&startYear=2027&endYear=2020")).status, 400);
    assert.equal((await call("?platformId=167", { method: "PUT" })).status, 405);
    assert.equal(bodies.length, count);
  } finally {
    globalThis.fetch = realFetch;
    names.forEach((name, index) => {
      if (old[index] === undefined) delete process.env[name];
      else process.env[name] = old[index];
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
