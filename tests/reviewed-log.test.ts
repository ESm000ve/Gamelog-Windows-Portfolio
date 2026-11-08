import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import { GamesRepo } from "../src/db/repositories/GamesRepo";
import { LogsRepo } from "../src/db/repositories/LogsRepo";
const game = {
  igdbId: 10001,
  title: "Review Quest",
  slug: "review",
  developer: "Test",
  releaseYear: 2020,
  genres: [],
  platforms: ["PC"],
};
beforeEach(async () => {
  await db.games.clear();
  await db.logs.clear();
});
test("reviewed log saves a new game and chosen fields together without replacing existing metadata", async () => {
  await GamesRepo.saveReviewedLog(game, { status: "Played", rating: 4.5, notes: "Reviewed" });
  assert.equal((await db.logs.get(game.igdbId))?.notes, "Reviewed");
  assert.equal((await db.logs.get(game.igdbId))?.rating, 4.5);
  const original = await db.games.get(game.igdbId);
  await GamesRepo.saveReviewedLog(
    { ...game, title: "Changed catalog title" },
    { status: "Playing" }
  );
  assert.deepEqual(await db.games.get(game.igdbId), original);
});
test("failed reviewed log save rolls back the new game and initial log", async () => {
  const save = LogsRepo.save;
  LogsRepo.save = async () => {
    throw new Error("Write failed");
  };
  try {
    await assert.rejects(GamesRepo.saveReviewedLog(game, { status: "Backlog" }), /Write failed/);
  } finally {
    LogsRepo.save = save;
  }
  assert.equal(await db.games.count(), 0);
  assert.equal(await db.logs.count(), 0);
});
