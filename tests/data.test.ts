import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import { GamesRepo } from "../src/db/repositories/GamesRepo";
import { LogsRepo } from "../src/db/repositories/LogsRepo";
import { ListsRepo } from "../src/db/repositories/ListsRepo";
import { BackupRepo } from "../src/db/repositories/BackupRepo";
import { parseBackup } from "../src/services/backupFormat";
import type { Game } from "../src/types";

const game: Game = {
  igdbId: 42,
  title: "Audit Game",
  slug: "audit-game",
  developer: "Studio",
  releaseYear: 2026,
  genres: ["Adventure"],
  platforms: ["PC"],
  embedding: [1, 0],
  addedAt: 1,
  updatedAt: 1,
};
// No test may contact an external service, including background embeddings.
globalThis.fetch = async () => {
  throw new Error("Network disabled in regression tests");
};
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
after(() => db.close());

test("adding a game twice preserves its personal log and metadata", async () => {
  await GamesRepo.addFromCatalog(game);
  await LogsRepo.save(42, {
    status: "Played",
    rating: 4.5,
    notes: "Keep me",
    completion: "Completed",
  });
  await GamesRepo.addFromCatalog({ ...game, title: "Duplicate" });
  assert.equal((await GamesRepo.get(42))?.title, "Audit Game");
  assert.equal((await LogsRepo.get(42))?.rating, 4.5);
  assert.equal((await LogsRepo.get(42))?.notes, "Keep me");
});

test("quick status changes clear completion and deleting a game cleans lists and logs", async () => {
  await GamesRepo.addFromCatalog(game);
  await LogsRepo.save(42, { status: "Played", completion: "Completed" });
  await LogsRepo.updateStatus(42, "Playing");
  assert.equal((await LogsRepo.get(42))?.completion, undefined);
  const listId = await ListsRepo.create("Favorites");
  await ListsRepo.addGame(listId, 42);
  await GamesRepo.remove(42);
  assert.equal(await GamesRepo.get(42), undefined);
  assert.equal(await LogsRepo.get(42), undefined);
  assert.deepEqual((await ListsRepo.get(listId))?.gameIds, []);
});

test("full backups round-trip games, logs, tags and ranked lists without network access", async () => {
  await db.games.put(game);
  await db.tags.put({ id: "tag", name: "Favorite", createdAt: 1, updatedAt: 1 });
  await db.logs.put({
    igdbId: 42,
    status: "Played",
    rating: 5,
    tagIds: ["tag"],
    playSessions: [{ date: "2026-10-26", durationMinutes: 60 }],
    createdAt: 1,
    updatedAt: 1,
  });
  const listId = await ListsRepo.create("Ranked", true);
  await ListsRepo.addGame(listId, 42);
  const backup = await BackupRepo.exportBackup();
  assert.equal(parseBackup(backup).version, 2);
  await Promise.all(db.tables.map((table) => table.clear()));
  await BackupRepo.importBackup(backup);
  assert.deepEqual(await db.games.get(42), game);
  assert.equal((await db.logs.get(42))?.rating, 5);
  assert.equal((await db.tags.get("tag"))?.name, "Favorite");
  assert.deepEqual((await db.lists.get(listId))?.gameIds, [42]);
});

test("invalid and unavailable legacy backups leave existing data intact", async () => {
  await db.games.put(game);
  for (const data of [
    { version: 99, games: [], logs: [], lists: [] },
    { version: 2, games: [], logs: [{ igdbId: 42 }], lists: [], tags: [] },
  ]) {
    await assert.rejects(BackupRepo.importBackup(JSON.stringify(data)));
    assert.deepEqual(await db.games.get(42), game);
  }
  await assert.rejects(
    BackupRepo.importBackup(
      JSON.stringify({
        version: 1,
        games: [{ igdbId: 999, addedAt: 1, updatedAt: 1 }],
        logs: [],
        lists: [],
      })
    )
  );
  assert.deepEqual(await db.games.get(42), game);
});

test("merge preserves unrelated records; replace accepts old full backups", async () => {
  await db.games.put(game);
  const imported = { ...game, igdbId: 43 };
  const backup = JSON.stringify({ version: 1, games: [imported], logs: [], lists: [] });
  await BackupRepo.importBackup(backup, "merge");
  assert.equal(await db.games.count(), 2);
  await BackupRepo.importBackup(backup, "replace");
  assert.deepEqual(await db.games.toArray(), [imported]);
});
import { importMatchedPlatformGames } from "../src/services/platformImport";
test("platform imports preserve existing logs and honor playtime overwrite", async () => {
  await db.games.put(game);
  await db.logs.put({
    igdbId: 42,
    status: "Played",
    rating: 5,
    timePlayed: 100,
    createdAt: 1,
    updatedAt: 1,
  });
  const matches = [
    {
      igdbGame: game,
      imported: { sourceId: "gog-42", sourceName: game.title, timePlayedHours: 10 },
      confidence: "high" as const,
    },
  ];
  await importMatchedPlatformGames(matches, "Backlog", false, "GOG");
  assert.equal((await db.logs.get(42))?.timePlayed, 100);
  await importMatchedPlatformGames(matches, "Backlog", true, "GOG");
  assert.equal((await db.logs.get(42))?.timePlayed, 10);
  assert.equal((await db.logs.get(42))?.status, "Played");
  assert.equal((await db.logs.get(42))?.rating, 5);
});
