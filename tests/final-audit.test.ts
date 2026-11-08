import "fake-indexeddb/auto";
import { LogsRepo } from "../src/db/repositories/LogsRepo";
import { computeYearInReview } from "../src/services/yearInReview";
import { db } from "../src/db/schema";
import { getSpotlight } from "../src/services/spotlight";
import { fetchDealsForWishlist } from "../src/services/priceTracker";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Game, Log } from "../src/types";
import { computeLibraryStatistics, recordedFinish } from "../src/services/libraryStatistics";
import { localGameDetail } from "../src/services/localGameDetail";
const game = (id: number): Game => ({
  igdbId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  developer: "Test",
  releaseYear: 2020,
  genres: ["RPG", "RPG"],
  platforms: ["PC", "PS5"],
  addedAt: 1,
  updatedAt: 1,
});
const log = (id: number, extra: Partial<Log> = {}): Log => ({
  igdbId: id,
  status: "Played",
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const now = new Date(2026, 9, 27, 12);

test("statistics include half-star ratings and only recorded, distinct personal platforms", () => {
  const result = computeLibraryStatistics(
    [game(1), game(2)],
    [
      log(1, { rating: 0.5, timePlayed: 8 }),
      log(2, { rating: 5, platforms: ["PC", "PC"] }),
      log(99, { rating: 5, timePlayed: 100 }),
    ],
    "all",
    now
  );
  assert.equal(result.avgRating, "2.8");
  assert.equal(result.hoursPlayed, 8);
  assert.equal(result.ratingChartData[0].value, 1);
  assert.deepEqual(result.platformChartData, [
    { label: "Not recorded", value: 1 },
    { label: "PC", value: 1 },
  ]);
  assert.deepEqual(result.genreChartData, [{ label: "RPG", value: 2 }]);
});
test("year cohorts exclude future and invalid finishes and logs no longer marked Played", () => {
  const logs = [
    log(1, { finishedAt: "2026-01-01", timePlayed: 12 }),
    log(2, { finishedAt: "2026-10-27" }),
    log(3, { finishedAt: "2026-10-28" }),
    log(4, { finishedAt: "2026-02-30" }),
    log(5, { finishedAt: "2026-02-01", status: "Backlog" }),
    log(6, { finishedAt: "2025-12-31" }),
  ];
  const result = computeLibraryStatistics(
    logs.map((l) => game(l.igdbId)),
    logs,
    "year",
    now
  );
  assert.equal(result.selectedGames, 2);
  assert.equal(result.playedThisYear, 2);
  assert.equal(result.hoursPlayed, 12);
  assert.equal(recordedFinish(logs[3], "2026-10-27"), null);
  assert.equal(result.totalGames, 6);
  assert.equal(result.statusCounts.Backlog, 1);
});
test("rolling year clamps leap-day anniversary and respects date-only boundaries", () => {
  const logs = [
    log(1, { finishedAt: "2023-02-27" }),
    log(2, { finishedAt: "2023-02-28" }),
    log(3, { finishedAt: "2024-02-29" }),
  ];
  const result = computeLibraryStatistics(
    logs.map((l) => game(l.igdbId)),
    logs,
    "months12",
    new Date(2024, 1, 29, 0, 1)
  );
  assert.equal(result.selectedGames, 2);
});
test("monthly chart uses actual recorded finishes, never reconstructed backlog history", () => {
  const logs = [
    log(1, { finishedAt: "2026-10-27" }),
    log(2, { finishedAt: "2026-10-28" }),
    log(3, { status: "Backlog", finishedAt: "2026-10-01" }),
    log(4, { finishedAt: "2025-11-01" }),
  ];
  const result = computeLibraryStatistics(
    logs.map((l) => game(l.igdbId)),
    logs,
    "all",
    now
  );
  assert.equal(result.finishesByMonth.length, 12);
  assert.equal(result.finishesByMonth.at(-1)!.value, 1);
  assert.equal(result.finishesByMonth[0].value, 1);
  assert.equal(
    result.finishesByMonth.reduce((sum, m) => sum + m.value, 0),
    2
  );
});
test("offline detail retains saved metadata without inventing media or related games", () => {
  const saved = {
    ...game(1),
    summary: "Saved description",
    coverUrl: "https://example.com/cover.jpg",
    igdbRating: 87,
    publisher: "Publisher",
    timeToBeat: { finish: 7 },
  };
  const detail = localGameDetail(saved);
  assert.equal(detail.title, saved.title);
  assert.equal(detail.releaseYear, 2020);
  assert.equal(detail.coverUrl, saved.coverUrl);
  assert.equal(detail.igdbRating.score, 87);
  assert.equal(detail.timeToBeat?.finish, 7);
  assert.equal(detail.publisher, "Publisher");
  assert.deepEqual(detail.related.related, []);
  assert.deepEqual(detail.screenshots, []);
});

test("weekly spotlight replaces a cached game after it leaves Backlog", async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
  try {
    await db.games.bulkPut([game(901), game(902)]);
    await db.logs.bulkPut([log(901, { status: "Backlog" }), log(902, { status: "Played" })]);
    assert.equal((await getSpotlight())?.game.igdbId, 901);
    await db.logs.update(901, { status: "Played" });
    await db.logs.update(902, { status: "Backlog" });
    assert.equal((await getSpotlight())?.game.igdbId, 902);
    await db.logs.update(902, { status: "Played" });
    assert.equal(await getSpotlight(), null);
  } finally {
    await db.games.clear();
    await db.logs.clear();
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("wishlist deals reject unrelated titles and invalid prices, and deduplicate requests", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  try {
    await db.games.bulkPut([game(903), game(904), game(905)]);
    globalThis.fetch = async () => {
      requests++;
      return new Response(
        JSON.stringify([{ external: "Unrelated game", cheapest: "1", cheapestDealID: "wrong" }])
      );
    };
    await fetchDealsForWishlist([game(903)]);
    assert.equal((await db.games.get(903))?.dealPrice, undefined);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([{ external: "Game 904", cheapest: "NaN", cheapestDealID: "bad" }])
      );
    await fetchDealsForWishlist([game(904)]);
    assert.equal((await db.games.get(904))?.dealPrice, undefined);
    requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return new Response(
        JSON.stringify([{ external: "Game 905", cheapest: "0.00", cheapestDealID: "free/deal" }])
      );
    };
    await Promise.all([fetchDealsForWishlist([game(905)]), fetchDealsForWishlist([game(905)])]);
    assert.equal(requests, 1);
    assert.equal((await db.games.get(905))?.dealPrice, 0);
    assert.match((await db.games.get(905))!.dealUrl!, /free%2Fdeal$/);
  } finally {
    globalThis.fetch = originalFetch;
    await db.games.clear();
    await db.logs.clear();
  }
});

test("mark played today is atomic, idempotent and never invents an hour", async () => {
  await db.games.put(game(906));
  await db.logs.put(log(906, { timePlayed: 10 }));
  try {
    const results = await Promise.all([LogsRepo.logSession(906), LogsRepo.logSession(906)]);
    assert.deepEqual(results.sort(), [false, true]);
    const saved = (await db.logs.get(906))!;
    assert.equal(saved.playSessions!.length, 1);
    assert.equal(saved.playSessions![0].durationMinutes, undefined);
    assert.equal(saved.timePlayed, 10);
    assert.equal(computeYearInReview([game(906)], [saved], new Date().getFullYear()).totalHours, 0);
    await db.logs.delete(906);
    await assert.rejects(LogsRepo.logSession(906), /no longer in your library/);
  } finally {
    await db.games.clear();
    await db.logs.clear();
  }
});
