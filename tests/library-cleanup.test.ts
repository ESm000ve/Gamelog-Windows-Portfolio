import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readLibraryView,
  readLibrarySort,
  loggedPlatforms,
  countLibrary,
  sortLibrary,
} from "../src/services/libraryPresentation";
import { filterEntries } from "../src/services/filterEngine";
import type { LibraryEntry } from "../src/types";
const entry = (id: number, title: string, year: number): LibraryEntry => ({
  game: {
    igdbId: id,
    title,
    slug: title,
    developer: "Test",
    releaseYear: year,
    platforms: ["PC", "Switch"],
    genres: [],
    addedAt: id,
    updatedAt: 1,
  },
  log: { igdbId: id, status: "Backlog", createdAt: 1, updatedAt: 1 },
});
test("Library preferences recover from invalid or missing stored values", () => {
  assert.equal(readLibraryView("broken"), "grid");
  assert.equal(readLibraryView("table"), "table");
  assert.equal(readLibrarySort(null), "recent");
  assert.equal(readLibrarySort("title-desc"), "title-desc");
  assert.equal(readLibrarySort("invalid"), "recent");
});
test("Library platform labels use all logged platforms and never catalog availability", () => {
  assert.deepEqual(loggedPlatforms(entry(1, "A", 2020).log), []);
  assert.deepEqual(
    loggedPlatforms({
      ...entry(1, "A", 2020).log,
      platform: "PC",
      platforms: [" Switch ", "PC", "Switch", ""],
    }),
    ["Switch", "PC"]
  );
});
test("Library status totals exclude orphan logs and games without a log", () => {
  const a = entry(1, "A", 2020),
    b = entry(2, "B", 2020);
  const counts = countLibrary([a.game, b.game], [a.log, { ...b.log, igdbId: 99 }]);
  assert.equal(counts.All, 1);
  assert.equal(counts.Backlog, 1);
});
test("Library year sorts keep unknown dates last in both directions and preserve input", () => {
  const entries = [entry(1, "Unknown", 0), entry(2, "Older", 1990), entry(3, "Newer", 2020)];
  assert.deepEqual(
    sortLibrary(entries, "year-asc").map((e) => e.game.title),
    ["Older", "Newer", "Unknown"]
  );
  assert.deepEqual(
    sortLibrary(entries, "year-desc").map((e) => e.game.title),
    ["Newer", "Older", "Unknown"]
  );
  assert.equal(entries[0].game.title, "Unknown");
});
test("Library numeric sorting is deterministic with unknown values and exact zero", () => {
  const a = entry(1, "A", 2020),
    b = entry(2, "B", 2020),
    c = entry(3, "C", 2020);
  a.log.timePlayed = 0;
  b.log.timePlayed = 5;
  c.log.timePlayed = NaN;
  assert.deepEqual(
    sortLibrary([c, a, b], "time").map((e) => e.game.title),
    ["B", "A", "C"]
  );
  a.log.rating = 4;
  b.log.rating = 4;
  assert.deepEqual(
    sortLibrary([b, a], "rating").map((e) => e.game.title),
    ["A", "B"]
  );
});
test("Library release filters exclude unknown and invalid dates", () => {
  assert.equal(
    filterEntries([entry(1, "Unknown", 0), entry(2, "Old", 1990)], { releaseYear: { max: 2000 } })
      .length,
    1
  );
});
