import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import { RecoveryRepo } from "../src/db/repositories/RecoveryRepo";
import { BackupRepo } from "../src/db/repositories/BackupRepo";
import { GamesRepo } from "../src/db/repositories/GamesRepo";
import type { Game, Log } from "../src/types";
const game = (id: number): Game => ({
  igdbId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  developer: "Studio",
  genres: [],
  platforms: ["PC"],
  releaseYear: 2026,
  addedAt: 1,
  updatedAt: 1,
});
const log = (id: number): Log => ({
  igdbId: id,
  status: "Played",
  rating: 4.5,
  notes: "Keep these notes",
  tagIds: ["favorite"],
  playSessions: [{ date: "2026-10-27", durationMinutes: 60 }],
  createdAt: 1,
  updatedAt: 1,
});
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.games.bulkPut([game(1), game(2), game(3)]);
  await db.logs.bulkPut([log(1), log(2), log(3)]);
  await db.tags.put({ id: "favorite", name: "Favorite", createdAt: 1, updatedAt: 1 });
  await db.lists.put({
    id: "ranked",
    name: "Favorites",
    isRanked: true,
    gameIds: [1, 2, 3],
    createdAt: 1,
    updatedAt: 1,
  });
});
after(() => db.close());
globalThis.fetch = async () => {
  throw new Error("No network in recovery tests");
};

test("removed games recover personal logs, tags, play sessions, and ranked list positions", async () => {
  const id = await RecoveryRepo.removeGame(2);
  assert.ok(id);
  assert.equal(await db.games.get(2), undefined);
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 3]);
  await db.tags.delete("favorite");
  await RecoveryRepo.restore(id);
  assert.equal((await db.logs.get(2))?.notes, "Keep these notes");
  assert.equal((await db.logs.get(2))?.rating, 4.5);
  assert.equal((await db.logs.get(2))?.playSessions?.[0].durationMinutes, 60);
  assert.equal((await db.tags.get("favorite"))?.name, "Favorite");
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 2, 3]);
  assert.equal(await db.removals.get(id), undefined);
});
test("a failed recovery snapshot aborts removal without losing any data", async () => {
  const fail = () => {
    throw new Error("Storage unavailable");
  };
  db.removals.hook("creating", fail);
  try {
    await assert.rejects(RecoveryRepo.removeGame(2), /Storage unavailable/);
  } finally {
    db.removals.hook("creating").unsubscribe(fail);
  }
  assert.ok(await db.games.get(2));
  assert.ok(await db.logs.get(2));
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 2, 3]);
  assert.equal(await db.removals.count(), 0);
});
test("restoration keeps newer list edits and refuses to overwrite a re-added personal log", async () => {
  const id = await RecoveryRepo.removeGame(2);
  assert.ok(id);
  await db.lists.update("ranked", { name: "Renamed", gameIds: [3, 1] });
  await RecoveryRepo.restore(id);
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [2, 3, 1]);
  assert.equal((await db.lists.get("ranked"))?.name, "Renamed");
  const again = await RecoveryRepo.removeGame(2);
  assert.ok(again);
  await db.games.put(game(2));
  await db.logs.put({ ...log(2), notes: "Newer notes" });
  await assert.rejects(RecoveryRepo.restore(again), /current entry/);
  assert.equal((await db.logs.get(2))?.notes, "Newer notes");
  assert.ok(await db.removals.get(again));
});
for (const order of ["game-first", "list-first"] as const)
  test(`games and lists can be recovered in either dependency order: ${order}`, async () => {
    let gameId: string | undefined, listId: string | undefined;
    if (order === "game-first") {
      gameId = await RecoveryRepo.removeGame(2);
      listId = await RecoveryRepo.removeList("ranked");
      await RecoveryRepo.restore(gameId!);
      await RecoveryRepo.restore(listId!);
    } else {
      listId = await RecoveryRepo.removeList("ranked");
      gameId = await RecoveryRepo.removeGame(2);
      await RecoveryRepo.restore(listId!);
      assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 3]);
      await RecoveryRepo.restore(gameId!);
    }
    assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 2, 3]);
    assert.equal((await db.lists.get("ranked"))?.isRanked, true);
  });
test("removing a list entry leaves the library intact and can be restored after reopening the database", async () => {
  const id = await RecoveryRepo.removeListGame("ranked", 2);
  assert.ok(id);
  assert.ok(await db.games.get(2));
  assert.ok(await db.logs.get(2));
  db.close();
  await db.open();
  assert.ok(await db.removals.get(id));
  await RecoveryRepo.restore(id);
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 2, 3]);
  await RecoveryRepo.restore(id);
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 2, 3]);
});
test("backup import undo restores the old library and retains newer edits as another recovery point", async () => {
  const incoming = {
    version: 2,
    exported: new Date().toISOString(),
    games: [game(10)],
    logs: [{ ...log(10), tagIds: [] }],
    lists: [],
    tags: [],
  };
  const id = await BackupRepo.importBackup(JSON.stringify(incoming), "replace");
  await db.logs.update(10, { notes: "Edited after import" });
  await RecoveryRepo.restore(id);
  assert.equal((await db.logs.get(2))?.notes, "Keep these notes");
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 2, 3]);
  assert.equal(await db.games.get(10), undefined);
  const retained = (await db.removals.toArray()).find((entry) => entry.kind === "library");
  assert.ok(retained && retained.kind === "library");
  assert.equal(retained.logs[0].notes, "Edited after import");
});
test("bulk-import undo recovers overwritten playtime without an external request", async () => {
  await db.logs.update(2, { timePlayed: 12 });
  const id = await GamesRepo.bulkImport([game(2)], [{ ...log(2), timePlayed: 30 }], true);
  assert.ok(id);
  assert.equal((await db.logs.get(2))?.timePlayed, 30);
  await RecoveryRepo.restore(id);
  assert.equal((await db.logs.get(2))?.timePlayed, 12);
});

test("discarding a recovery copy does not change the current library", async () => {
  const id = await RecoveryRepo.removeListGame("ranked", 2);
  assert.ok(id);
  await RecoveryRepo.forget(id);
  assert.equal(await db.removals.get(id), undefined);
  assert.equal((await db.logs.get(2))?.notes, "Keep these notes");
  assert.deepEqual((await db.lists.get("ranked"))?.gameIds, [1, 3]);
});
