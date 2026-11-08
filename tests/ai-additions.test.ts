import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db/schema";
import type { Game, Log, LibraryEntry } from "../src/types";
import {
  localLibraryCriteria,
  matchLibrary,
  interpretLibraryRequest,
  createReviewedList,
} from "../src/services/libraryAssistant";
import {
  splitRecapSources,
  readRecapBullets,
  readSavedRecap,
} from "../src/services/recapContracts";
import { generateResumeRecap, saveResumeRecap } from "../src/services/resumeRecap";
import { BackupRepo } from "../src/db/repositories/BackupRepo";
const realFetch = globalThis.fetch;
const game = (id: number, extra: Partial<Game> = {}): Game => ({
  igdbId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  developer: "Test",
  releaseYear: 2024,
  genres: ["Role-playing (RPG)"],
  platforms: ["PC (Microsoft Windows)"],
  timeToBeat: { finish: 4 },
  addedAt: 1,
  updatedAt: 1,
  ...extra,
});
const log = (id: number, extra: Partial<Log> = {}): Log => ({
  igdbId: id,
  status: "Backlog",
  notes: "Reached the old bridge.\nNext: find Mira near the inn.",
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const entries: LibraryEntry[] = [
  { game: game(1), log: log(1) },
  { game: game(2, { timeToBeat: { finish: 50 } }), log: log(2) },
  {
    game: game(3, { platforms: ["PC (Microsoft Windows)", "Nintendo Switch"] }),
    log: log(3, { platforms: ["PC (Microsoft Windows)"] }),
  },
  {
    game: game(4, { platforms: ["Nintendo Switch"] }),
    log: log(4, { status: "Played", platform: "Nintendo Switch" }),
  },
];
beforeEach(async () => {
  globalThis.fetch = realFetch;
  await Promise.all([db.games.clear(), db.logs.clear(), db.lists.clear(), db.removals.clear()]);
});
after(async () => {
  globalThis.fetch = realFetch;
  await db.delete();
});
test("local finder understands spelled-out hour limits and canonical genre names", () => {
  const criteria = localLibraryCriteria("My backlog RPGs under ten hours", entries);
  assert.equal(criteria.filters.timeToBeat?.max, 10);
  assert.deepEqual(criteria.filters.status, ["Backlog"]);
  assert.deepEqual(
    matchLibrary(entries, criteria).map((entry) => entry.game.igdbId),
    [1, 3]
  );
});
test("recorded-platform finder never treats multi-platform availability as ownership", () => {
  const criteria = localLibraryCriteria("My Switch games", entries);
  assert.deepEqual(criteria.filters.platforms, ["Nintendo Switch"]);
  assert.deepEqual(
    matchLibrary(entries, criteria).map((entry) => entry.game.igdbId),
    [4]
  );
});
test("finder excludes unknown or nonfinite durations with a limit, and supports title review", () => {
  const candidates = [
    ...entries,
    { game: game(5, { timeToBeat: undefined }), log: log(5) },
    { game: game(6, { timeToBeat: { finish: NaN } }), log: log(6) },
  ];
  assert.deepEqual(
    matchLibrary(candidates, { titleQuery: "Game 1", filters: { timeToBeat: { max: 5 } } }).map(
      (entry) => entry.game.igdbId
    ),
    [1]
  );
  assert.ok(
    !matchLibrary(candidates, { titleQuery: "", filters: { timeToBeat: { max: 5 } } }).some(
      (entry) => entry.game.igdbId >= 5
    )
  );
});
test("AI finder sends only its request and validates returned criteria", async () => {
  let payload: any;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({
      target: "library",
      igdbSearchQuery: "",
      filters: { genres: ["RPG"], maxTime: 10, status: "Backlog" },
    });
  };
  const result = await interpretLibraryRequest(
    "RPGs under ten hours",
    entries,
    false,
    new AbortController().signal
  );
  assert.equal(result.mode, "ai");
  assert.deepEqual(Object.keys(payload).sort(), ["query", "scope"]);
  assert.doesNotMatch(JSON.stringify(payload), /Mira|old bridge/);
  assert.deepEqual(
    matchLibrary(entries, result).map((entry) => entry.game.igdbId),
    [1, 3]
  );
});
test("quota failures produce an explicit editable local draft; cancellation does not", async () => {
  globalThis.fetch = async () => Response.json({ error: "Quota reached" }, { status: 429 });
  const result = await interpretLibraryRequest(
    "Backlog RPGs under 5 hours",
    entries,
    true,
    new AbortController().signal
  );
  assert.equal(result.mode, "local");
  assert.match(result.notice, /Quota reached.*Local draft/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(interpretLibraryRequest("Backlog", entries, false, controller.signal));
});
test("creating a reviewed list is atomic and rejects stale or ineligible members", async () => {
  await db.games.bulkAdd(entries.map((entry) => entry.game));
  await db.logs.bulkAdd(entries.map((entry) => entry.log));
  const criteria = localLibraryCriteria("Backlog under five hours", entries, true);
  await assert.rejects(createReviewedList("Weekend", [1, 2], criteria));
  assert.equal(await db.lists.count(), 0);
  const id = await createReviewedList("  Weekend  ", [1, 1, 3], criteria);
  assert.deepEqual((await db.lists.get(id))?.gameIds, [1, 3]);
  assert.equal((await db.lists.get(id))?.name, "Weekend");
  await db.logs.update(3, { status: "Played" });
  await assert.rejects(createReviewedList("Changed", [3], criteria));
  assert.equal(await db.lists.count(), 1);
});
test("recap source selection respects limits and rejects invalid citations", () => {
  const sources = splitRecapSources("Reached bridge.\nFind Mira.");
  assert.equal(sources.length, 2);
  assert.deepEqual(
    readRecapBullets({ bullets: [{ text: "Find Mira.", sourceIds: [2, 2] }] }, sources),
    [{ text: "Find Mira.", sourceIds: [2] }]
  );
  for (const sourceIds of [[], [99], ["1"]])
    assert.throws(() =>
      readRecapBullets({ bullets: [{ text: "Unsupported", sourceIds }] }, sources)
    );
  assert.throws(() => splitRecapSources("x".repeat(12001)));
  assert.equal(readSavedRecap({ bullets: [], sources: [] }), null);
});
test("recaps never send notes without consent and send only the selected excerpts", async () => {
  let calls = 0,
    payload: any;
  globalThis.fetch = async (_url, init) => {
    calls++;
    payload = JSON.parse(String(init?.body));
    return Response.json({ bullets: [{ text: "Find Mira near the inn.", sourceIds: [1] }] });
  };
  await assert.rejects(
    generateResumeRecap("Test", "Find Mira near the inn.", false, new AbortController().signal)
  );
  assert.equal(calls, 0);
  const result = await generateResumeRecap(
    "Test",
    "Find Mira near the inn.",
    true,
    new AbortController().signal
  );
  assert.deepEqual(Object.keys(payload).sort(), ["consent", "sources", "title"]);
  assert.doesNotMatch(JSON.stringify(payload), /old bridge/);
  assert.equal(result.bullets[0].sourceIds[0], 1);
});
test("recap saves preserve notes and status, reject note edits, and round-trip in backups", async () => {
  const original = log(1, { status: "Playing" });
  await db.games.add(game(1));
  await db.logs.add(original);
  const draft = {
    sources: splitRecapSources("Find Mira near the inn."),
    bullets: [{ text: "Find Mira near the inn.", sourceIds: [1] }],
  };
  await saveResumeRecap(1, draft, { notes: original.notes!, createdAt: 1 });
  const current = await db.logs.get(1);
  assert.equal(current?.notes, original.notes);
  assert.equal(current?.status, "Playing");
  assert.ok(current?.resumeRecap);
  const backup = JSON.parse(await BackupRepo.exportBackup());
  assert.ok(backup.logs[0].resumeRecap);
  await db.logs.clear();
  await BackupRepo.importBackup(JSON.stringify(backup), "replace");
  assert.equal((await db.logs.get(1))?.resumeRecap?.bullets[0].text, "Find Mira near the inn.");
  await db.logs.update(1, { notes: "Newer personal notes" });
  await assert.rejects(saveResumeRecap(1, draft, { notes: original.notes!, createdAt: 1 }));
  assert.equal((await db.logs.get(1))?.notes, "Newer personal notes");
});
test("cancelled recaps do not return a result or silently save", async () => {
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    return Response.json({ bullets: [{ text: "Find Mira.", sourceIds: [1] }] });
  };
  await assert.rejects(generateResumeRecap("Test", "Find Mira.", true, controller.signal));
  assert.equal(await db.logs.count(), 0);
});

test("local fallback does not turn an explicitly excluded genre into a positive filter", () => {
  const result = localLibraryCriteria("Backlog without RPG", entries, true);
  assert.equal(result.filters.genres, undefined);
});
