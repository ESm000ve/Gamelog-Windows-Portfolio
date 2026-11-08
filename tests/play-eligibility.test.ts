import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eligiblePlayEntries,
  lastPlayedDate,
  readyToReplay,
  replayCutoff,
  drawPlayPick,
  readPlayPreferences,
} from "../src/services/playEligibility";
import type { Game, Log } from "../src/types";
const now = new Date(2026, 9, 28, 12);
const game = (id: number, hours?: number): Game => ({
  igdbId: id,
  title: `Quest ${id}`,
  slug: `quest-${id}`,
  developer: "Test",
  releaseYear: 2020,
  genres: [],
  platforms: [],
  addedAt: now.getTime(),
  updatedAt: now.getTime(),
  timeToBeat: hours === undefined ? undefined : { finish: hours },
});
const log = (id: number, fields: Partial<Log> = {}): Log => ({
  igdbId: id,
  status: "Played",
  createdAt: now.getTime(),
  updatedAt: now.getTime(),
  ...fields,
});
test("replay uses the latest real activity rather than metadata edits and excludes the calendar anniversary", () => {
  assert.equal(
    lastPlayedDate(
      log(1, {
        startedAt: "2020-01-01",
        finishedAt: "2021-01-01",
        playSessions: [{ date: "2026-02-01" }, { date: "2099-01-01" }, { date: "2026-02-30" }],
      }),
      now
    ),
    "2026-02-01"
  );
  assert.equal(readyToReplay(log(1, { finishedAt: "2025-10-27" }), now), true);
  assert.equal(readyToReplay(log(1, { finishedAt: "2025-10-28" }), now), false);
  assert.equal(
    readyToReplay(
      log(1, { finishedAt: "2024-01-01", playSessions: [{ date: "2026-10-27" }] }),
      now
    ),
    false
  );
  assert.equal(readyToReplay(log(1, { finishedAt: "2024-01-01" }), now), true);
  assert.equal(replayCutoff(new Date(2024, 1, 29)), "2023-02-28");
});
test("unknown or invalid dates allow played games to return without claiming they were never played", () => {
  for (const finishedAt of [undefined, "", "invalid", "2026-02-30", "2027-01-01"])
    assert.equal(readyToReplay(log(1, { finishedAt }), now), true);
  assert.equal(readyToReplay(log(1, { status: "Wishlist" }), now), false);
  assert.equal(readyToReplay(log(1, { status: "Playing" }), now), false);
});
test("all pools exclude wishlist and orphan records; hour limits exclude unknown or invalid estimates", () => {
  const games = [
    game(1, 3),
    game(2, 4),
    game(3, 5),
    game(4),
    game(5, NaN),
    game(6, 2),
    game(7, 3),
    game(8, -1),
  ];
  const logs = [
    log(1, { status: "Backlog" }),
    log(2, { status: "Playing" }),
    log(3, { finishedAt: "2024-01-01" }),
    log(4),
    log(5),
    log(6, { status: "Wishlist" }),
    log(8),
    log(99),
  ];
  const ids = (pool: "ready" | "backlog" | "playing" | "revisit", maxHours?: number) =>
    eligiblePlayEntries(games, logs, { pool, maxHours }, now).map((entry) => entry.game.igdbId);
  assert.deepEqual(ids("ready"), [1, 2, 3, 4, 5, 8]);
  assert.deepEqual(ids("backlog"), [1]);
  assert.deepEqual(ids("playing"), [2]);
  assert.deepEqual(ids("revisit", 5), [3]);
  assert.deepEqual(ids("ready", 4), [1, 2]);
});
test("roulette visits every candidate before resetting and avoids an immediate repeat", () => {
  const entries = [1, 2, 3].map((id) => ({ game: game(id), log: log(id) }));
  const seen = new Set<number>();
  let last: number | undefined;
  for (let i = 0; i < 3; i++) {
    const pick = drawPlayPick(entries, seen, last, () => 0)!;
    assert.equal(pick.reset, false);
    assert.ok(!seen.has(pick.entry.game.igdbId));
    last = pick.entry.game.igdbId;
    seen.add(last);
  }
  const next = drawPlayPick(entries, seen, last, () => 0)!;
  assert.equal(next.reset, true);
  assert.notEqual(next.entry.game.igdbId, last);
  assert.equal(drawPlayPick([], seen), null);
  assert.equal(drawPlayPick([entries[0]], new Set([1]), 1, () => 0)?.entry.game.igdbId, 1);
});
test("saved play filters reject malformed state and preserve only supported choices", () => {
  assert.deepEqual(readPlayPreferences("bad"), { pool: "ready", intent: "" });
  assert.deepEqual(
    readPlayPreferences(JSON.stringify({ pool: "wishlist", maxHours: -5, intent: 7 })),
    { pool: "ready", maxHours: undefined, intent: "" }
  );
  assert.deepEqual(
    readPlayPreferences(JSON.stringify({ pool: "revisit", maxHours: 10, intent: "a puzzle" })),
    { pool: "revisit", maxHours: 10, intent: "a puzzle" }
  );
});
