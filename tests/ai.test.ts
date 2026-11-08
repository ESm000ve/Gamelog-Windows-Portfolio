import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import type { Game, Log } from "../src/types";
import {
  readParsedLog,
  readParsedQuery,
  readPicks,
  EMBEDDING_MODEL,
} from "../src/services/aiContracts";
import { cosineSimilarity, generateTasteInsights, parseLog } from "../src/services/ai";
import {
  getRecommendations,
  preRankCandidates,
  getTasteProfile,
} from "../src/services/recommender";
import { computeTasteAggregates } from "../src/services/stats";
import { similarityScore, prepareGameMatches } from "../src/services/gameSimilarity";
const originalFetch = globalThis.fetch;
const game = (id: number, extra: Partial<Game> = {}): Game => ({
  igdbId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  developer: "Test",
  releaseYear: 2024,
  genres: ["RPG"],
  platforms: ["PC"],
  addedAt: 1,
  updatedAt: 1,
  ...extra,
});
const log = (id: number, extra: Partial<Log> = {}): Log => ({
  igdbId: id,
  status: "Backlog",
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
beforeEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all([db.games.clear(), db.logs.clear()]);
});
after(async () => {
  globalThis.fetch = originalFetch;
  await db.delete();
});
test("AI log drafts validate dates, ratings and taxonomy, dropping unrelated fields", () => {
  const draft = readParsedLog({
    title: " Test ",
    logFields: {
      status: "Played",
      completion: "Completed",
      rating: 4.5,
      timePlayed: 0,
      finishedAt: "2026-10-26",
      notes: "injected",
      igdbId: 999,
    },
  });
  assert.equal(draft.title, "Test");
  assert.equal(draft.logFields.timePlayed, 0);
  assert.ok(!("notes" in draft.logFields));
  for (const fields of [
    { rating: 9 },
    { rating: 3.7 },
    { status: "Finished" },
    { status: "Backlog", completion: "Completed" },
    { finishedAt: "2026-02-30" },
    { timePlayed: -1 },
    { ownership: ["Pirated"] },
    { startedAt: "2026-10-27", finishedAt: "2026-10-26" },
  ])
    assert.throws(() => readParsedLog({ title: "Test", logFields: fields }));
});
test("structured search rejects malformed outputs and preserves valid library intent", () => {
  assert.throws(() => readParsedQuery({ target: "anything", igdbSearchQuery: "", filters: {} }));
  assert.throws(() =>
    readParsedQuery({ target: "library", igdbSearchQuery: "", filters: { minRating: 20 } })
  );
  assert.equal(
    readParsedQuery({
      target: "library",
      igdbSearchQuery: "",
      filters: { maxTime: 5, status: "Unplayed" },
    }).filters.maxTime,
    5
  );
});
test("recommendation output removes invented IDs, duplicates and malformed reasons", () => {
  assert.deepEqual(
    readPicks(
      {
        picks: [
          { id: 1, reason: "Known" },
          { id: 1, reason: "Duplicate" },
          { id: 999, reason: "Invented" },
          { id: 2, reason: { bad: true } },
        ],
      },
      new Set([1, 2])
    ),
    [{ id: 1, reason: "Known" }]
  );
});
test("similarity rejects invalid and incompatible vectors without NaN", () => {
  for (const values of [[NaN], [Infinity], [0], []]) assert.equal(cosineSimilarity(values, [1]), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
  assert.ok(Math.abs(cosineSimilarity([1e300, 1e300], [1e300, 1e300]) - 1) < 1e-9);
  assert.equal(
    similarityScore(
      { genres: ["RPG"], embedding: [1, 0], embeddingModel: "other" },
      { genres: ["RPG"], embedding: [0, 1], embeddingModel: EMBEDDING_MODEL }
    ),
    1
  );
  assert.equal(
    similarityScore({ genres: [], embedding: [1, 0] }, { genres: [], embedding: [1, 0] }),
    0
  );
});
test("a highly rated backlog game never recommends itself as the taste match", async () => {
  await db.games.add(game(1, { embedding: [1, 0], embeddingModel: EMBEDDING_MODEL }));
  await db.logs.add(log(1, { rating: 5 }));
  const result = await preRankCandidates();
  assert.equal(result[0].matchedGame, undefined);
  assert.equal(result[0].similarity, 0);
});
test("taste average includes low ratings and backlog count excludes wishlist and orphan logs", async () => {
  await db.games.bulkAdd([game(1), game(2), game(3)]);
  await db.logs.bulkAdd([
    log(1, { rating: 5, status: "Played" }),
    log(2, { rating: 1 }),
    log(3, { status: "Wishlist" }),
    log(999),
  ]);
  const profile = await getTasteProfile();
  assert.equal(profile.avgRating, 3);
  assert.equal(profile.backlogCount, 1);
  assert.equal(profile.topRatedCount, 1);
});
test("initial picks use local metadata with no AI request or empty-keyword claim", async () => {
  await db.games.add(game(1));
  await db.logs.add(log(1));
  globalThis.fetch = async () => {
    throw new Error("must not request AI");
  };
  const result = await getRecommendations("");
  assert.equal(result.mode, "local");
  assert.equal(result.picks.length, 1);
  assert.doesNotMatch(result.picks[0].reason!, /keyword/);
});
test("collection and duration constraints apply before the AI shortlist and to fallback", async () => {
  await db.games.bulkAdd([
    ...Array.from({ length: 22 }, (_, i) =>
      game(i + 1, { timeToBeat: { finish: 50 }, igdbRating: 99 })
    ),
    game(30, { timeToBeat: { finish: 3 }, igdbRating: 10 }),
    game(31, { timeToBeat: { finish: 2 } }),
    game(32),
  ]);
  await db.logs.bulkAdd([
    ...Array.from({ length: 22 }, (_, i) => log(i + 1)),
    log(30, { notes: "private-note" }),
    log(31, { status: "Wishlist" }),
    log(32),
  ]);
  let payload: any;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({
      picks: [
        { id: 30, reason: "3-hour main story" },
        { id: 1, reason: "outside limit" },
        { id: 30, reason: "duplicate" },
      ],
    });
  };
  const result = await getRecommendations("under 5 hours", [], { requestAi: true });
  assert.deepEqual(
    result.picks.map((p) => p.game.igdbId),
    [30]
  );
  assert.deepEqual(
    payload.candidates.map((p: any) => p.id),
    [30]
  );
  assert.doesNotMatch(JSON.stringify(payload), /private-note/);
  globalThis.fetch = async () => Response.json({ error: "Quota reached" }, { status: 429 });
  const fallback = await getRecommendations("short", [], { requestAi: true, maxHours: 5 });
  assert.equal(fallback.mode, "local");
  assert.deepEqual(
    fallback.picks.map((p) => p.game.igdbId),
    [30]
  );
  assert.match(fallback.message, /Quota reached/);
  assert.deepEqual(
    (await preRankCandidates([], { maxHours: 5, pool: "ready" })).map((p) => p.game.igdbId).sort(),
    [30]
  );
});
test("cancelled AI refinement does not return a stale local fallback", async () => {
  await db.games.add(game(1));
  await db.logs.add(log(1));
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    throw new DOMException("Cancelled", "AbortError");
  };
  await assert.rejects(
    getRecommendations("RPG", [], { requestAi: true, signal: controller.signal })
  );
});
test("insight length buckets use estimated story time and include sample sizes", () => {
  const games = [
    game(1, { genres: ["RPG", "RPG"], timeToBeat: { finish: 80 } }),
    game(2, { timeToBeat: { finish: 80 } }),
    game(3),
  ];
  const logs = [
    log(1, { status: "Played", completion: "Abandoned", timePlayed: 1, rating: 2 }),
    log(2, { status: "Played", completion: "Completed", timePlayed: 10, rating: 4 }),
    log(3, { status: "Backlog", completion: "Completed", rating: 5 }),
  ];
  const result = computeTasteAggregates(games, logs);
  assert.equal(result.totalCompleted, 1);
  assert.equal(result.totalAbandoned, 1);
  assert.equal(result.totalRated, 3);
  assert.equal(result.completionRateByLength["60h+"].rate, 0.5);
  assert.equal(result.completionRateByLength["<10h"], undefined);
  assert.equal(result.ratingSamplesByGenre.RPG, 3);
  assert.equal(result.ratingSamplesByLength["60h+"], 2);
});
test("sparse taste data stays local and malformed insight arrays are rejected", async () => {
  const sparse = computeTasteAggregates([], []);
  globalThis.fetch = async () => {
    throw new Error("must stay local");
  };
  assert.match((await generateTasteInsights(sparse))[0], /three games/);
  globalThis.fetch = async () => Response.json({ insights: [{ bad: "object" }] });
  await assert.rejects(generateTasteInsights({ ...sparse, totalGames: 3, totalRated: 3 }));
});
test("match preparation records model provenance, resumes and respects Stop", async () => {
  await db.games.bulkAdd([game(1), game(2)]);
  let calls = 0;
  const controller = new AbortController();
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ embedding: [1, 2], model: EMBEDDING_MODEL });
  };
  await assert.rejects(
    prepareGameMatches((done) => {
      if (done === 1) controller.abort();
    }, controller.signal)
  );
  assert.equal((await db.games.get(1))?.embeddingModel, EMBEDDING_MODEL);
  assert.equal((await db.games.get(2))?.embedding, undefined);
  await prepareGameMatches(() => {}, new AbortController().signal);
  assert.equal(calls, 2);
});
test("quick-log client rejects a malformed successful response", async () => {
  globalThis.fetch = async () => Response.json({ title: "Test", logFields: { rating: 99 } });
  await assert.rejects(parseLog("I rated Test 4 stars"));
});

test("imported vectors cannot inherit another embedding's model provenance", async () => {
  const { GamesRepo } = await import("../src/db/repositories/GamesRepo");
  await db.games.add(game(1, { embedding: [1, 0], embeddingModel: EMBEDDING_MODEL }));
  await db.logs.add(log(1));
  await GamesRepo.bulkImport([game(1, { embedding: [0, 1] })], [], false);
  assert.equal((await db.games.get(1))?.embeddingModel, undefined);
});
