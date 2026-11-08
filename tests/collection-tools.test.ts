import "fake-indexeddb/auto";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import { saveSessionHistory, validateSessions } from "../src/services/sessionHistory";
import { RecoveryRepo } from "../src/db/repositories/RecoveryRepo";
import {
  readSavedViews,
  describeSavedView,
  storeView,
  removeView,
  restoreView,
  validView,
} from "../src/services/savedViews";
import {
  lessLike,
  readRecommendationFeedback,
  clearRecommendationFeedback,
} from "../src/services/recommendationFeedback";
import { preRankCandidates, getRecommendations } from "../src/services/recommender";
import { computeYearInReview } from "../src/services/yearInReview";
import { localDate } from "../src/utils/dates";
import type { Game, Log } from "../src/types";
const game = (id: number, genres = ["RPG"]): Game => ({
  igdbId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  developer: "Test",
  releaseYear: 2024,
  genres,
  platforms: ["PC"],
  timeToBeat: { finish: 3 },
  igdbRating: 100 - id * 10,
  addedAt: 1,
  updatedAt: 1,
});
const log = (id: number): Log => ({
  igdbId: id,
  status: "Backlog",
  notes: "Personal note",
  timePlayed: 99,
  createdAt: 1,
  updatedAt: 1,
});
const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let storage: Map<string, string>;
beforeEach(async () => {
  await Promise.all([db.games.clear(), db.logs.clear(), db.removals.clear()]);
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});
afterEach(() => {
  if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
  else Reflect.deleteProperty(globalThis, "localStorage");
});
test("session edits preserve personal totals and notes and can be undone after restart", async () => {
  const before = [{ date: localDate(), durationMinutes: 60 }];
  await db.games.put(game(1));
  await db.logs.put({ ...log(1), playSessions: before });
  const id = await saveSessionHistory(1, [{ date: localDate(), durationMinutes: 30 }], {
    createdAt: 1,
    sessions: before,
  });
  const saved = (await db.logs.get(1))!;
  assert.equal(saved.timePlayed, 99);
  assert.equal(saved.notes, "Personal note");
  assert.equal(computeYearInReview([game(1)], [saved], new Date().getFullYear()).totalHours, 0.5);
  assert.equal(saved.playSessions![0].durationMinutes, 30);
  db.close();
  await db.open();
  await db.logs.update(1, { notes: "Newer note" });
  await RecoveryRepo.restore(id);
  assert.deepEqual((await db.logs.get(1))!.playSessions, before);
  assert.equal((await db.logs.get(1))!.notes, "Newer note");
});
test("session draft validation rejects future dates, rolled dates and invalid durations", () => {
  for (const date of ["2026-02-30", "2099-01-01", "bad"])
    assert.throws(() => validateSessions([{ date }], "2026-10-27"));
  for (const durationMinutes of [NaN, Infinity, -1, 1441])
    assert.throws(() => validateSessions([{ date: "2026-01-01", durationMinutes }], "2026-10-27"));
  assert.deepEqual(validateSessions([{ date: "2026-01-01" }], "2026-10-27"), [
    { date: "2026-01-01" },
  ]);
});
test("stale saves and undo cannot overwrite newer session edits", async () => {
  await db.games.put(game(1));
  await db.logs.put(log(1));
  const expected = { createdAt: 1, sessions: [] };
  const id = await saveSessionHistory(1, [{ date: localDate() }], expected);
  await assert.rejects(saveSessionHistory(1, [], expected), /changed elsewhere/);
  await db.logs.update(1, { playSessions: [{ date: localDate(), durationMinutes: 5 }] });
  await assert.rejects(RecoveryRepo.restore(id), /newer changes/);
  assert.ok(await db.removals.get(id));
  await db.logs.delete(1);
  await assert.rejects(saveSessionHistory(1, [], expected), /removed or replaced/);
});
test("failed session recovery snapshot aborts the edit", async () => {
  await db.games.put(game(1));
  await db.logs.put(log(1));
  const fail = () => {
    throw new Error("Storage full");
  };
  db.removals.hook("creating", fail);
  try {
    await assert.rejects(
      saveSessionHistory(1, [{ date: localDate() }], { createdAt: 1, sessions: [] }),
      /Storage full/
    );
  } finally {
    db.removals.hook("creating").unsubscribe(fail);
  }
  assert.equal((await db.logs.get(1))!.playSessions, undefined);
});
const draft = {
  name: "Short backlog",
  filters: {
    status: ["Backlog" as const],
    timeToBeat: { max: 5 },
    platformSource: "recorded" as const,
  },
  search: "Quest",
  sort: "title-asc" as const,
  viewMode: "table" as const,
};
test("saved views round-trip reviewed criteria and support update and undo deletion", () => {
  const view = storeView(draft);
  assert.deepEqual(readSavedViews(), [view]);
  assert.match(describeSavedView(view), /Backlog/);
  assert.doesNotMatch(describeSavedView(view), /title-asc|platformSource|timeToBeat/);
  assert.throws(() => storeView({ ...draft, name: "short BACKLOG" }), /already exists/);
  storeView({ ...draft, search: "Other" }, view.id);
  assert.equal(readSavedViews()[0].search, "Other");
  removeView(view.id);
  assert.equal(readSavedViews().length, 0);
  restoreView(view);
  assert.deepEqual(readSavedViews()[0], view);
  assert.throws(() => restoreView(view), /already exists/);
});
test("invalid saved storage and failed writes do not apply or silently report a saved view", () => {
  storage.set("gamelog.savedLibraryViews.v1", '{"broken":true}');
  assert.deepEqual(readSavedViews(), []);
  assert.equal(validView({ ...draft, id: "x", filters: { rating: { min: 5, max: 1 } } }), false);
  assert.equal(validView({ ...draft, id: "x", filters: { status: ["fabricated"] } }), false);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage full");
      },
    },
  });
  assert.throws(() => storeView(draft), /Storage full/);
});
test("recommendation feedback persists locally, hides a game, lowers shared genres, and resets without AI", async () => {
  const games = [game(1), game(2), game(3, ["Puzzle"])];
  await db.games.bulkPut(games);
  await db.logs.bulkPut(games.map((g) => log(g.igdbId)));
  assert.deepEqual(
    (await preRankCandidates()).map((c) => c.game.igdbId),
    [1, 2, 3]
  );
  lessLike(games[0]);
  lessLike(games[0]);
  assert.equal(readRecommendationFeedback().length, 1);
  assert.deepEqual(
    (await preRankCandidates()).map((c) => c.game.igdbId),
    [3, 2]
  );
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request");
  };
  try {
    assert.equal((await getRecommendations("", [], { requestAi: false })).picks[0].game.igdbId, 3);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal((await db.logs.get(1))!.notes, "Personal note");
  clearRecommendationFeedback(1);
  assert.equal((await preRankCandidates())[0].game.igdbId, 1);
  lessLike(games[1]);
  clearRecommendationFeedback();
  assert.deepEqual(readRecommendationFeedback(), []);
});
