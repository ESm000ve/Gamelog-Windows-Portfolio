import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLibraryStatistics } from "../src/services/libraryStatistics";
import type { Game, Log } from "../src/types";
const now = new Date(2026, 9, 28, 12);
const game = (id: number, extra: Partial<Game> = {}): Game => ({
  igdbId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  developer: "Test",
  releaseYear: 2024,
  genres: [],
  platforms: [],
  addedAt: new Date(2026, 9, 1, 12).getTime(),
  updatedAt: 1,
  ...extra,
});
const log = (id: number, extra: Partial<Log> = {}): Log => ({
  igdbId: id,
  status: "Played",
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
test("highlights rank actual recorded hours and personal ratings, excluding invalid values and orphan logs", () => {
  const games = [
    game(1, { title: "Zelda" }),
    game(2, { title: "Alpha" }),
    game(3),
    game(4),
    game(5),
  ];
  const logs = [
    log(1, { timePlayed: 50, rating: 5 }),
    log(2, { timePlayed: 50, rating: 5 }),
    log(3, { timePlayed: 0, rating: 0.5 }),
    log(4, { timePlayed: NaN, rating: 3.3 }),
    log(5, { timePlayed: -10, rating: Infinity }),
    log(99, { timePlayed: 1000, rating: 5 }),
  ];
  const h = computeLibraryStatistics(games, logs, "all", now).highlights;
  assert.deepEqual(
    h.mostPlayed.map((e) => e.game.igdbId),
    [2, 1]
  );
  assert.deepEqual(
    h.favorites.map((e) => e.game.igdbId),
    [2, 1, 3]
  );
  assert.equal(h.hoursRecordedCount, 2);
  assert.equal(h.ratedCount, 3);
});
test("completion rate distinguishes recorded outcomes, missing outcomes and current status", () => {
  const games = Array.from({ length: 6 }, (_, i) => game(i + 1));
  const logs = [
    log(1, { completion: "Completed" }),
    log(2, { completion: "Mastered" }),
    log(3, { completion: "Abandoned" }),
    log(4, { completion: "Shelved" }),
    log(5),
    log(6, { status: "Backlog", completion: "Completed" }),
  ];
  const h = computeLibraryStatistics(games, logs, "all", now).highlights;
  assert.deepEqual(h.completion, { completed: 2, knownOutcomes: 4, unspecified: 1, rate: 50 });
  assert.equal(
    h.outcomeData.reduce((sum, item) => sum + item.value, 0),
    5
  );
});
test("game highlights and decades follow finish cohorts while oldest backlog stays all-time", () => {
  const games = [
    game(1, { releaseYear: 1998 }),
    game(2, { releaseYear: 2020 }),
    game(3, { addedAt: new Date(2025, 0, 1, 12).getTime() }),
    game(4),
  ];
  const logs = [
    log(1, { finishedAt: "2025-01-01", rating: 5, timePlayed: 100 }),
    log(2, { finishedAt: "2026-01-01", rating: 4, timePlayed: 5, completion: "Mastered" }),
    log(3, { status: "Backlog" }),
    log(4, { finishedAt: "2026-10-29", timePlayed: 200 }),
  ];
  const h = computeLibraryStatistics(games, logs, "year", now).highlights;
  assert.deepEqual(
    h.mostPlayed.map((e) => e.game.igdbId),
    [2]
  );
  assert.deepEqual(h.decadeData, [{ label: "2020s", value: 1 }]);
  assert.equal(h.oldestBacklog?.game.igdbId, 3);
  assert.equal(h.completion.rate, 100);
});
test("backlog age uses valid original additions and calendar days", () => {
  const games = [
    game(1, { addedAt: now.getTime() + 1000 }),
    game(2, { addedAt: -1 }),
    game(3, { addedAt: new Date(2026, 9, 27, 23, 59).getTime() }),
  ];
  const logs = games.map((g) => log(g.igdbId, { status: "Backlog" }));
  const h = computeLibraryStatistics(games, logs, "all", now).highlights;
  assert.equal(h.oldestBacklog?.game.igdbId, 3);
  assert.equal(h.oldestBacklog?.days, 1);
});
test("empty and sparse records never invent favorites, hours, completion or release dates", () => {
  const empty = computeLibraryStatistics([], [], "all", now).highlights;
  assert.deepEqual(empty.mostPlayed, []);
  assert.deepEqual(empty.favorites, []);
  assert.equal(empty.completion.rate, null);
  assert.equal(empty.oldestBacklog, null);
  const h = computeLibraryStatistics(
    [game(1, { releaseYear: 0 })],
    [log(1, { status: "Wishlist" })],
    "all",
    now
  ).highlights;
  assert.deepEqual(h.decadeData, [{ label: "Not recorded", value: 1 }]);
  assert.equal(h.completion.rate, null);
});
