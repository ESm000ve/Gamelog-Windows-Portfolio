import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail } from "../src/types/gameDetail";
import {
  detailScore,
  safeExternalUrl,
  personalActivity,
  firstReleaseLabel,
  resolveRelatedTab,
} from "../src/services/gameDetailPresentation";
const raw = { id: 1, name: "Quest", slug: "quest" };
test("detail scores keep genuine zero and reject invalid scores", () => {
  assert.equal(detailScore(0), 0);
  for (const value of [NaN, Infinity, -1, 101, undefined])
    assert.equal(detailScore(value), undefined);
  assert.equal(
    normalizeDetail({ ...raw, rating: 0, aggregated_rating: 0 }, null).igdbRating.score,
    0
  );
});
test("detail external links normalize web URLs and exclude unsafe or malformed destinations", () => {
  assert.equal(safeExternalUrl("//example.com/game"), "https://example.com/game");
  assert.equal(safeExternalUrl("example.com"), "https://example.com/");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "https://user:pass@example.com",
    "https://",
    "",
  ])
    assert.equal(safeExternalUrl(value), undefined);
});
test("normalizing related games removes duplicates and self references without changing source arrays", () => {
  const games = [
    { id: 3, name: "Later", slug: "later", total_rating_count: 1 },
    { id: 2, name: "First", slug: "first", total_rating_count: 5 },
    { ...raw },
    { id: 2, name: "First", slug: "first", total_rating_count: 5 },
  ];
  const normalized = normalizeDetail({ ...raw, similar_games: games }, null);
  assert.deepEqual(
    normalized.related.related.map((game) => game.id),
    [3, 2]
  );
  assert.equal(games[0].id, 3);
  assert.equal(games.length, 4);
});
test("related categories honor requested categories and recover from stale selections", () => {
  const detail = normalizeDetail(
    {
      ...raw,
      similar_games: [{ id: 2, name: "Other", slug: "other" }],
      dlcs: [{ id: 3, name: "DLC", slug: "dlc" }],
    },
    null
  );
  assert.equal(resolveRelatedTab(detail, "dlcs"), "dlcs");
  assert.equal(resolveRelatedTab(detail, "series"), "related");
  assert.equal(resolveRelatedTab(normalizeDetail(raw, null), "dlcs"), null);
});
test("personal activity uses valid session dates and actual durations separately from lifetime hours", () => {
  const result = personalActivity(
    {
      igdbId: 1,
      status: "Playing",
      timePlayed: 999,
      createdAt: 1,
      updatedAt: 1,
      playSessions: [
        { date: "2026-10-27", durationMinutes: 60 },
        { date: "2026-10-28" },
        { date: "2026-02-30", durationMinutes: 60 },
        { date: "2027-01-01", durationMinutes: 60 },
      ],
    },
    "2026-10-28"
  );
  assert.equal(result.sessions, 2);
  assert.equal(result.lastPlayed, "2026-10-28");
  assert.equal(result.sessionHours, 1);
  assert.equal(result.unknownDuration, 1);
});
test("first release dates use UTC calendar dates and missing dates remain unknown", () => {
  assert.match(
    firstReleaseLabel({ releaseYear: 2020, firstReleaseDate: Date.UTC(2020, 0, 1) / 1000 }),
    /Jan 1, 2020/
  );
  assert.equal(firstReleaseLabel({ releaseYear: 0 }), "Not listed");
  assert.equal(firstReleaseLabel({ releaseYear: 2020 }), "2020");
});
