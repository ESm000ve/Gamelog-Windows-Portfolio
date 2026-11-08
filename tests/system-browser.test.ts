import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getLibrarySystemCounts,
  getSystemEra,
  normalizeSystemPlatform,
  parseSystemBrowserState,
  sortSystems,
  type SystemPlatform,
} from "../src/services/systemBrowser";
import type { Game, Log } from "../src/types";
const platform = (id: number, name: string, abbreviation?: string): SystemPlatform => ({
  id,
  name,
  abbreviation,
  manufacturers: [],
});
const game = (igdbId: number, platforms: string[]): Game => ({
  igdbId,
  title: `Game ${igdbId}`,
  slug: `game-${igdbId}`,
  developer: "Test",
  releaseYear: 2024,
  genres: [],
  platforms,
  addedAt: 1,
  updatedAt: 1,
});
const log = (igdbId: number, values: Partial<Log> = {}): Log => ({
  igdbId,
  status: "Backlog",
  createdAt: 1,
  updatedAt: 1,
  ...values,
});

test("platform eras use the earliest hardware release rather than its generation or a shared name", () => {
  const original = normalizeSystemPlatform({
    id: 130,
    name: "Nintendo Switch",
    generation: 8,
    versions: [
      { platform_version_release_dates: [{ y: 2019 }, { date: Date.UTC(2017, 2, 3) / 1000 }] },
    ],
  });
  const successor = normalizeSystemPlatform({
    id: 508,
    name: "Nintendo Switch 2",
    generation: 8,
    versions: [{ platform_version_release_dates: [{ y: 2025 }] }],
  });
  assert.equal(original.releaseYear, 2017);
  assert.equal(getSystemEra(original), "2010s");
  assert.equal(getSystemEra(successor), "2020s");
  assert.equal(getSystemEra({ ...platform(86, "PC Engine"), releaseYear: 1987 }), "1980s");
  assert.equal(getSystemEra(platform(6, "PC (Microsoft Windows)")), "Computers and mobile");
  assert.equal(
    getSystemEra({ ...platform(99, "Undated console"), generation: 9 }),
    "Release date unavailable"
  );
});

test("platform metadata preserves manufacturers and ignores invalid release dates", () => {
  const system = normalizeSystemPlatform({
    id: 1,
    name: "PlayStation",
    versions: [
      {
        main_manufacturer: { company: { name: "Sony Interactive Entertainment" } },
        platform_version_release_dates: [{ date: 0 }, { y: 0 }, { y: 1994 }],
      },
    ],
  });
  assert.equal(system.releaseYear, 1994);
  assert.deepEqual(system.manufacturers, ["Sony"]);
  const outsourced = normalizeSystemPlatform({
    id: 130,
    name: "Nintendo Switch",
    versions: [
      {
        companies: [
          { manufacturer: true, company: { name: "Foxconn" } },
          { manufacturer: false, company: { name: "Developer only" } },
        ],
      },
    ],
  });
  assert.deepEqual(outsourced.manufacturers, ["Nintendo", "Foxconn"]);
});

test("personal systems count chosen platforms once and do not treat catalog availability as ownership", () => {
  const systems = [
    platform(6, "PC (Microsoft Windows)", "PC"),
    platform(48, "PlayStation 4", "PS4"),
    platform(41, "Wii U", "WiiU"),
  ];
  const result = getLibrarySystemCounts(
    systems,
    [
      game(1, ["PC (Microsoft Windows)", "PlayStation 4"]),
      game(2, ["Wii U"]),
      game(3, ["PC (Microsoft Windows)", "PlayStation 4"]),
      game(4, ["PC (Microsoft Windows)"]),
    ],
    [
      log(1, { platforms: ["PC", "PC (Microsoft Windows)"] }),
      log(2),
      log(3),
      log(4, { platform: "PC", status: "Playing" }),
      log(999, { platform: "PS4" }),
    ]
  );
  assert.deepEqual(result.counts.get(6), { games: 2, backlog: 1, playing: 1 });
  assert.deepEqual(result.counts.get(41), { games: 1, backlog: 1, playing: 0 });
  assert.equal(result.counts.has(48), false);
  assert.equal(result.unassigned, 1);
});

test("release sorting keeps undated systems last in both directions without mutating input", () => {
  const systems = [
    platform(1, "Unknown"),
    { ...platform(2, "New"), releaseYear: 2025 },
    { ...platform(3, "Old"), releaseYear: 1989 },
  ];
  assert.deepEqual(
    sortSystems(systems, "newest", new Map()).map((p) => p.id),
    [2, 3, 1]
  );
  assert.deepEqual(
    sortSystems(systems, "oldest", new Map()).map((p) => p.id),
    [3, 2, 1]
  );
  assert.deepEqual(
    systems.map((p) => p.id),
    [1, 2, 3]
  );
});

test("saved browsing preferences recover from invalid storage and validate restored values", () => {
  assert.equal(parseSystemBrowserState("{broken").view, "yours");
  const saved = parseSystemBrowserState(
    JSON.stringify({
      view: "all",
      sort: "bogus",
      group: "manufacturer",
      query: "PS",
      scrollTop: -50,
      collapsed: ["era:1990s", 42],
    })
  );
  assert.equal(saved.view, "all");
  assert.equal(saved.sort, "name");
  assert.equal(saved.group, "manufacturer");
  assert.equal(saved.scrollTop, 0);
  assert.deepEqual(saved.collapsed, ["era:1990s"]);
});
