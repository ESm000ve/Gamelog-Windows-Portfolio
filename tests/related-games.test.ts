import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanRelatedGames,
  browseRelated,
  readRelatedBrowse,
  relatedYear,
  readRelatedPosition,
  writeRelatedPosition,
  defaultSeriesGroup,
  seriesGroupGames,
  resolveSeriesGroup,
} from "../src/services/relatedGames";
import { normalizeDetail } from "../src/types/gameDetail";
const games = [
  {
    id: 2,
    name: "Low popularity match",
    slug: "low",
    total_rating_count: 1,
    first_release_date: Date.UTC(2020, 0, 1) / 1000,
  },
  {
    id: 3,
    name: "Popular match",
    slug: "popular",
    total_rating_count: 999,
    first_release_date: Date.UTC(1990, 0, 1) / 1000,
  },
  { id: 4, name: "Undated", slug: "undated" },
];
test("related suggestion ranking is preserved instead of replaced by popularity", () => {
  const result = normalizeDetail(
    { id: 1, name: "Source", slug: "source", _custom_related: games },
    null
  );
  assert.deepEqual(
    result.related.related.map((game) => game.id),
    [2, 3, 4]
  );
});
test("related data drops malformed games, duplicates, self references and non-main suggestions", () => {
  const result = cleanRelatedGames(
    [
      ...games,
      games[0],
      { id: 1, name: "Self", slug: "self" },
      { id: 0, name: "Bad", slug: "bad" },
      { id: 5, name: " ", slug: "blank" },
      { id: 6, name: "DLC", slug: "dlc", category: 1 },
    ],
    1,
    true
  );
  assert.deepEqual(
    result.map((game) => game.id),
    [2, 3, 4]
  );
  assert.equal(cleanRelatedGames([{ id: 6, name: "DLC", slug: "dlc", category: 1 }], 1).length, 1);
});
test("related browsing combines title and library scope without mutating catalog order", () => {
  const result = browseRelated(games, { query: "MATCH", scope: "in", sort: "name" }, new Set([3]));
  assert.deepEqual(
    result.map((game) => game.id),
    [3]
  );
  assert.deepEqual(
    browseRelated(games, { query: "", scope: "new", sort: "catalog" }, new Set([3])).map(
      (game) => game.id
    ),
    [2, 4]
  );
  assert.equal(games[0].id, 2);
});
test("related release sorts keep undated titles last and support genuine pre-1970 releases", () => {
  assert.deepEqual(
    browseRelated(games, { query: "", scope: "all", sort: "oldest" }, new Set()).map(
      (game) => game.id
    ),
    [3, 2, 4]
  );
  assert.deepEqual(
    browseRelated(games, { query: "", scope: "all", sort: "newest" }, new Set()).map(
      (game) => game.id
    ),
    [2, 3, 4]
  );
  assert.equal(
    relatedYear({
      id: 5,
      name: "Early",
      slug: "early",
      first_release_date: Date.UTC(1960, 0, 1) / 1000,
    }),
    "1960"
  );
  assert.equal(
    relatedYear({ ...games[0], first_release_date: Infinity }),
    "Release date not listed"
  );
});
test("series chronology uses exact release dates rather than popularity", () => {
  const detail = normalizeDetail(
    { id: 1, name: "Source", slug: "source", collections: [{ name: "Series", games }] },
    null
  );
  assert.deepEqual(
    detail.related.series.map((game) => game.id),
    [3, 2, 4]
  );
});
test("malformed browsing preferences recover predictably", () => {
  assert.deepEqual(readRelatedBrowse(new URLSearchParams("sort=broken&library=broken&q=Quest")), {
    query: "Quest",
    sort: "catalog",
    scope: "all",
  });
  assert.deepEqual(readRelatedPosition("broken", "key"), { top: 0, limit: 48 });
  assert.deepEqual(readRelatedPosition('{"key":{"top":-1,"limit":1}}', "key"), {
    top: 0,
    limit: 48,
  });
});
test("return-position storage restores loaded batches and stays bounded", () => {
  let raw: string | null = null;
  for (let index = 0; index < 20; index++)
    raw = writeRelatedPosition(raw, String(index), index * 10, 96);
  assert.equal(Object.keys(JSON.parse(raw!)).length, 12);
  assert.deepEqual(readRelatedPosition(raw, "19"), { top: 190, limit: 96 });
});

test("series search ignores punctuation, accents and word order and accepts sequel numbers", () => {
  const series = [
    { id: 1, name: "Final Fantasy VII Remake", slug: "ff7" },
    { id: 2, name: "Final Fantasy XVII", slug: "ff17" },
    { id: 3, name: "Pokémon: Legends", slug: "pokemon" },
  ];
  assert.deepEqual(
    browseRelated(
      series,
      { query: "remake fantasy 7", scope: "all", sort: "catalog" },
      new Set()
    ).map((game) => game.id),
    [1]
  );
  assert.deepEqual(
    browseRelated(series, { query: "fantasy 7", scope: "all", sort: "catalog" }, new Set()).map(
      (game) => game.id
    ),
    [1]
  );
  assert.deepEqual(
    browseRelated(
      series,
      { query: "pokemon legends", scope: "all", sort: "catalog" },
      new Set()
    ).map((game) => game.id),
    [3]
  );
});
test("named series stays separate from a broad franchise without guessing mainline membership", () => {
  const detail = normalizeDetail(
    {
      id: 1,
      name: "Source",
      slug: "source",
      collections: [{ name: "Specific series", slug: "specific", games: [games[0]] }],
      franchises: [{ name: "Broad franchise", slug: "broad", games }],
    },
    null
  );
  assert.equal(defaultSeriesGroup(detail), "collections");
  assert.deepEqual(
    seriesGroupGames(detail, "collections").map((game) => game.id),
    [2]
  );
  assert.equal(seriesGroupGames(detail, "all").length, 3);
  assert.equal(resolveSeriesGroup(detail, "invalid"), "collections");
  assert.equal(
    defaultSeriesGroup(
      normalizeDetail(
        {
          id: 1,
          name: "Source",
          slug: "source",
          franchises: [{ name: "Broad", slug: "broad", games }],
        },
        null
      )
    ),
    "all"
  );
});
test("game-type filtering distinguishes games, versions and unclassified entries", () => {
  const rows = [{ ...games[0], category: 0 }, { ...games[1], category: 8 }, games[2]];
  assert.deepEqual(
    browseRelated(rows, { query: "", scope: "all", sort: "catalog", type: "games" }, new Set()).map(
      (game) => game.id
    ),
    [2]
  );
  assert.deepEqual(
    browseRelated(
      rows,
      { query: "", scope: "all", sort: "catalog", type: "versions" },
      new Set()
    ).map((game) => game.id),
    [3]
  );
  assert.deepEqual(
    browseRelated(
      rows,
      { query: "", scope: "all", sort: "catalog", type: "unknown" },
      new Set()
    ).map((game) => game.id),
    [4]
  );
});

test("expanded game types survive IGDB migration without assuming table IDs equal old enums", () => {
  const rows = cleanRelatedGames(
    [
      { ...games[0], game_type: { id: 100, type: "Main Game" } },
      { ...games[1], game_type: { id: 108, type: "Remake" } },
      { ...games[2], game_type: { id: 1, type: "Future Classification" } },
      { id: 5, name: "Extra", slug: "extra", game_type: { id: 201, type: "DLC Addon" } },
    ],
    999
  );
  const filter = (type: "games" | "versions" | "unknown") =>
    browseRelated(rows, { query: "", scope: "all", sort: "catalog", type }, new Set()).map(
      (game) => game.id
    );
  assert.deepEqual(filter("games"), [2]);
  assert.deepEqual(filter("versions"), [3]);
  assert.deepEqual(filter("unknown"), [4]);
  assert.deepEqual(
    cleanRelatedGames(rows, 999, true).map((game) => game.id),
    [2, 3, 4]
  );
});
