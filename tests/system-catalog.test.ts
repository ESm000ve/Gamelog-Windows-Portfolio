import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import { SystemCatalogRepo } from "../src/db/repositories/SystemCatalogRepo";
import { RecoveryRepo } from "../src/db/repositories/RecoveryRepo";
import {
  systemFilterError,
  parseSystemCatalog,
  type SystemCatalogFilters,
} from "../src/services/systemCatalog";
import { normalizeSystemPlatform } from "../src/services/systemBrowser";
import type { CatalogGame } from "../src/catalog";
const game: CatalogGame = {
  igdbId: 9001,
  title: "Quest",
  slug: "quest",
  developer: "Test",
  releaseYear: 2020,
  genres: ["Adventure"],
  platforms: ["PC", "Nintendo Switch"],
};
const filters: SystemCatalogFilters = {
  sort: "popularity",
  q: "",
  includeAll: false,
  genre: "",
  startYear: "",
  endYear: "",
  minRating: "",
};
beforeEach(async () => {
  await Promise.all([
    db.games.clear(),
    db.logs.clear(),
    db.lists.clear(),
    db.tags.clear(),
    db.removals.clear(),
  ]);
});
test("catalog year ranges and community scores reject impossible requests", () => {
  for (const patch of [
    { startYear: "2027", endYear: "2020" },
    { startYear: "123" },
    { startYear: "2101" },
    { minRating: "101" },
    { minRating: "-1" },
    { minRating: "1.5" },
  ])
    assert.ok(systemFilterError({ ...filters, ...patch }));
  assert.equal(
    systemFilterError({ ...filters, startYear: "1990", endYear: "2020", minRating: "0" }),
    null
  );
});
test("catalog responses deduplicate games and stop empty pagination", () => {
  const data = parseSystemCatalog({ games: [game, game], hasMore: true });
  assert.equal(data.games.length, 1);
  assert.equal(data.hasMore, true);
  assert.equal(parseSystemCatalog({ games: [], hasMore: true }).hasMore, false);
  assert.throws(() => parseSystemCatalog({}));
  assert.throws(() => parseSystemCatalog({ games: [{ igdbId: 0, title: "Invalid" }] }));
});
test("manufacturer choices reject numeric catalog placeholders", () => {
  const platform = normalizeSystemPlatform({
    id: 1,
    name: "Test",
    versions: [
      {
        companies: [
          { manufacturer: true, company: { name: "12345" } },
          { manufacturer: true, company: { name: "Nintendo" } },
        ],
      },
    ],
  });
  assert.deepEqual(platform.manufacturers, ["Nintendo"]);
});
test("single system addition is atomic, retains catalog availability, and can be undone", async () => {
  const recovery = await SystemCatalogRepo.save(game, "Nintendo Switch", {
    status: "Played",
    rating: 4.5,
  });
  assert.deepEqual((await db.games.get(game.igdbId))?.platforms, game.platforms);
  assert.equal((await db.logs.get(game.igdbId))?.platform, "Nintendo Switch");
  assert.equal((await db.logs.get(game.igdbId))?.rating, 4.5);
  assert.ok(recovery);
  await RecoveryRepo.restore(recovery);
  assert.equal(await db.games.count(), 0);
  assert.equal(await db.logs.count(), 0);
});
test("system quick changes preserve personal records and original metadata", async () => {
  await SystemCatalogRepo.save(game, "Nintendo Switch", { status: "Playing" });
  await db.logs.update(game.igdbId, {
    notes: "Keep me",
    timePlayed: 42,
    playSessions: [{ date: "2026-10-28" }],
  });
  await SystemCatalogRepo.save({ ...game, title: "Changed" }, "PC", { rating: 5 });
  const log = await db.logs.get(game.igdbId);
  assert.equal(log?.status, "Playing");
  assert.equal(log?.platform, "Nintendo Switch");
  assert.equal(log?.timePlayed, 42);
  assert.equal(log?.notes, "Keep me");
  assert.equal(log?.playSessions?.length, 1);
  assert.equal((await db.games.get(game.igdbId))?.title, "Quest");
});
test("bulk system additions deduplicate and never overwrite existing library records", async () => {
  await SystemCatalogRepo.save(game, "PC", { status: "Playing" });
  const next = { ...game, igdbId: 9002, title: "Garden" };
  const result = await SystemCatalogRepo.addSelected(
    [game, next, next],
    "Nintendo Switch",
    "Wishlist"
  );
  assert.equal(result.count, 1);
  assert.equal(await db.games.count(), 2);
  assert.equal((await db.logs.get(game.igdbId))?.status, "Playing");
  assert.equal((await db.logs.get(next.igdbId))?.status, "Wishlist");
  assert.equal((await SystemCatalogRepo.addSelected([game, next], "PC", "Played")).count, 0);
});
test("failed system addition rolls back both game and log writes", async () => {
  const original = db.logs.put.bind(db.logs);
  db.logs.put = async () => {
    throw new Error("Simulated write failure");
  };
  try {
    await assert.rejects(SystemCatalogRepo.save(game, "PC", { status: "Backlog" }), /Simulated/);
  } finally {
    db.logs.put = original;
  }
  assert.equal(await db.games.count(), 0);
  assert.equal(await db.logs.count(), 0);
  assert.equal(await db.removals.count(), 0);
});
