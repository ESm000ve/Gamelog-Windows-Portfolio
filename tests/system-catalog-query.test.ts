import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemCatalogQuery, catalogTitleClause } from "../server/systemCatalogQuery.ts";
import { readSystemCatalogState } from "../src/services/systemCatalog";
const types = [
  { id: 0, type: "Main Game" },
  { id: 108, type: "Remake" },
  { id: 203, type: "Bundle" },
  { id: 301, type: "DLC Addon" },
  { id: 777, type: "Future Classification" },
];
const query = (values: Record<string, string> = {}, ids: number[] = []) =>
  buildSystemCatalogQuery(new URLSearchParams({ platformId: "167", ...values }), ids, types).body;
test("catalog types use current named table IDs and never mistake them for old enum values", () => {
  assert.match(query(), /game_type = \(0,108\)/);
  assert.match(query({ type: "versions" }), /game_type = \(108\)/);
  assert.match(query({ type: "bundles" }), /game_type = \(203\)/);
  assert.match(query({ type: "unknown" }), /game_type != \(0,108,203,301\)/);
  assert.doesNotMatch(query({ type: "all" }), /game_type =/);
});
test("full catalog scope and combined filters apply before limit and offset", () => {
  const body = query(
    {
      library: "in",
      genre: "12",
      startYear: "2020",
      minRating: "80",
      offset: "50",
      q: "fantasy remake 7",
    },
    [12, 44]
  );
  assert.match(body, /id = \(12,44\)/);
  assert.match(body, /genres = \(12\)/);
  assert.match(body, /total_rating >= 80/);
  assert.match(body, /offset 50;/);
  assert.match(body, /name ~ \*"fantasy"\*/);
  assert.match(body, /name ~ \*"remake"\*/);
  assert.match(body, / VII /);
  assert.doesNotMatch(body, / XVII/);
  assert.match(query({ library: "in" }), /id = 0/);
  assert.match(query({ library: "new" }, [12]), /id != \(12\)/);
});
test("title tokens tolerate word order and punctuation without query injection or numeric substring matching", () => {
  const clause = catalogTitleClause('remake; fantasy "7"');
  assert.doesNotMatch(clause, /;/);
  assert.match(clause, /name ~ \*"remake"\*/);
  assert.match(clause, /name ~ \*" 7 "\*/);
  assert.doesNotMatch(clause, /name ~ \*"7"\*/);
  assert.match(catalogTitleClause("fantasy vii"), / VII /);
  assert.match(catalogTitleClause("F1 2020"), /name ~ \*"f1"\*/);
  assert.match(catalogTitleClause("WWE 2K24"), /name ~ \*"2k24"\*/);
});
test("invalid catalog requests are rejected before upstream calls", () => {
  for (const patch of [
    { platformId: "x" },
    { type: "invalid" },
    { library: "owned" },
    { sort: "injected;" },
    { startYear: "2027", endYear: "2020" },
    { offset: "-1" },
    { q: "x".repeat(121) },
  ])
    assert.throws(() => query(patch));
});
test("system browsing preferences preserve filters and covers default and recover malformed values", () => {
  const saved = readSystemCatalogState(
    JSON.stringify({ filters: { type: "versions", library: "new", q: "fantasy 7" }, view: "list" })
  );
  assert.equal(saved.filters.type, "versions");
  assert.equal(saved.filters.library, "new");
  assert.equal(saved.filters.q, "fantasy 7");
  assert.equal(saved.view, "list");
  assert.equal(readSystemCatalogState("bad").view, "grid");
  assert.equal(readSystemCatalogState(null).filters.type, "playable");
});
