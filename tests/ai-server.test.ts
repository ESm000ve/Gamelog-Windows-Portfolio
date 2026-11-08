import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { attachAiRoutes } from "../server/ai.ts";
const realFetch = globalThis.fetch;
test("AI endpoints validate requests and outputs, bound upstream calls, and keep provider details private", async (t) => {
  const names = ["GEMINI_API_KEY", "VITE_GEMINI_API_KEY", "GEMINI_TEXT_MODEL"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.GEMINI_API_KEY = "private-test-key";
  delete process.env.VITE_GEMINI_API_KEY;
  process.env.GEMINI_TEXT_MODEL = "gemini-2.5-flash";
  const app = express();
  attachAiRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/ai/`;
  const post = (route: string, body: unknown) =>
    realFetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  const generated = (value: unknown) =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [{ thought: true, text: "internal thought" }, { text: JSON.stringify(value) }],
          },
        },
      ],
    });
  try {
    await t.test(
      "invalid input and oversized requests stop before contacting the provider",
      async () => {
        let called = 0;
        globalThis.fetch = async () => {
          called++;
          return generated({});
        };
        for (const [route, body] of [
          ["parse-log", { text: "hi", currentDate: "2026-02-30" }],
          ["embed", { text: { bad: true } }],
          ["recommend", { intent: "hi", candidates: Array(21).fill({}) }],
          ["taste-insights", { totalGames: -1, totalRated: 3 }],
        ] as const)
          assert.equal((await post(route, body)).status, 400);
        assert.equal(
          (await post("parse-log", { text: "x".repeat(140000), currentDate: "2026-10-27" })).status,
          413
        );
        assert.equal(called, 0);
      }
    );
    await t.test(
      "malformed generated log fields return 502 rather than passing into the editor",
      async () => {
        globalThis.fetch = async () => generated({ title: "Test", logFields: { rating: 20 } });
        const response = await post("parse-log", { text: "Test", currentDate: "2026-10-27" });
        assert.equal(response.status, 502);
      }
    );
    await t.test(
      "structured generation sends a schema and bounded signal with the API key in a header",
      async () => {
        globalThis.fetch = async (url, init) => {
          assert.doesNotMatch(String(url), /private-test-key/);
          assert.equal(
            ((init?.headers ?? {}) as Record<string, string>)["x-goog-api-key"],
            "private-test-key"
          );
          assert.ok(init?.signal);
          const body = JSON.parse(String(init?.body));
          assert.ok(body.systemInstruction);
          assert.ok(body.generationConfig.responseSchema);
          assert.equal(body.generationConfig.maxOutputTokens, 4096);
          return generated({ title: "Test", logFields: { rating: 4.5 } });
        };
        const response = await post("parse-log", {
          text: "Test 4.5 stars",
          currentDate: "2026-10-27",
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).logFields.rating, 4.5);
      }
    );
    await t.test("quota and authentication failures have actionable sanitized errors", async () => {
      for (const [upstream, expected] of [
        [429, 429],
        [403, 503],
        [500, 502],
      ]) {
        globalThis.fetch = async () =>
          new Response("private-test-key and provider diagnostics", { status: upstream });
        const response = await post("parse-search", { query: "RPG" });
        assert.equal(response.status, expected);
        assert.doesNotMatch(await response.text(), /private-test-key|diagnostics/);
      }
    });
    await t.test("upstream timeouts become a retryable response", async () => {
      globalThis.fetch = async () => {
        throw new DOMException("timeout", "TimeoutError");
      };
      assert.equal((await post("parse-search", { query: "RPG" })).status, 504);
    });
    await t.test("embedding failure does not switch into a different vector space", async () => {
      let calls = 0;
      globalThis.fetch = async (url) => {
        calls++;
        assert.match(String(url), /gemini-embedding-001:embedContent/);
        return new Response("down", { status: 503 });
      };
      assert.equal((await post("embed", { text: "unique failure sample" })).status, 502);
      assert.equal(calls, 1);
    });
    await t.test("recommendations retain only unique eligible IDs", async () => {
      globalThis.fetch = async () =>
        generated({
          picks: [
            { id: 1, reason: "An RPG" },
            { id: 1, reason: "duplicate" },
            { id: 999, reason: "invented" },
          ],
        });
      const response = await post("recommend", {
        intent: "RPG",
        candidates: [{ id: 1, title: "Test", genres: ["RPG"] }],
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { picks: [{ id: 1, reason: "An RPG" }] });
    });
    await t.test(
      "resume recaps require consent and reject unsupported source references",
      async () => {
        let calls = 0;
        globalThis.fetch = async () => {
          calls++;
          return generated({ bullets: [{ text: "Find Mira", sourceIds: [99] }] });
        };
        const body = { title: "Test", sources: [{ id: 1, text: "Find Mira near the inn." }] };
        assert.equal((await post("resume-recap", body)).status, 400);
        assert.equal(calls, 0);
        assert.equal((await post("resume-recap", { ...body, consent: true })).status, 502);
        globalThis.fetch = async (_url, init) => {
          const payload = JSON.parse(String(init?.body));
          assert.ok(payload.generationConfig.responseSchema);
          assert.match(payload.contents[0].parts[0].text, /Find Mira near the inn/);
          return generated({ bullets: [{ text: "Find Mira near the inn.", sourceIds: [1] }] });
        };
        const valid = await post("resume-recap", { ...body, consent: true });
        assert.equal(valid.status, 200);
        assert.equal((await valid.json()).bullets[0].sourceIds[0], 1);
      }
    );
    await t.test(
      "missing configuration and sparse data remain usable without provider calls",
      async () => {
        delete process.env.GEMINI_API_KEY;
        let called = 0;
        globalThis.fetch = async () => {
          called++;
          return generated({});
        };
        assert.equal((await post("parse-search", { query: "RPG" })).status, 503);
        const sparse = await post("taste-insights", { totalGames: 1, totalRated: 1 });
        assert.equal(sparse.status, 200);
        assert.match((await sparse.json()).insights[0], /three games/);
        assert.equal(called, 0);
      }
    );
  } finally {
    globalThis.fetch = realFetch;
    for (const name of names) {
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
