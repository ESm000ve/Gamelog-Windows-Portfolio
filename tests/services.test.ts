import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCalendarICS } from "../src/services/calendarSync";
import { generateMarkdownList } from "../src/services/listShare";
import { filterEntries } from "../src/services/filterEngine";
import { localDate } from "../src/utils/dates";
import type { Game, Log } from "../src/types";
const game: Game = {
  igdbId: 42,
  title: "Game, One; Two",
  slug: "game",
  developer: "Studio",
  releaseYear: 2026,
  firstReleaseDate: Date.UTC(2026, 1, 2) / 1000,
  genres: ["Adventure"],
  platforms: ["PC"],
  addedAt: 1,
  updatedAt: 1,
};
const log: Log = {
  igdbId: 42,
  status: "Played",
  rating: 4.5,
  startedAt: "2026-01-31",
  tagIds: ["a", "b"],
  createdAt: 1,
  updatedAt: 1,
};
test("calendar keeps local start dates and handles month boundaries", () => {
  const result = generateCalendarICS([{ game, log }]);
  assert.match(result, /DTSTART;VALUE=DATE:20260131/);
  assert.match(result, /DTEND;VALUE=DATE:20260201/);
  assert.match(result, /Game\\, One\\; Two/);
  assert.ok(result.includes("\\nRating: 4.5/5"));
});
test("calendar uses exact release dates when no start date is logged", () => {
  assert.match(generateCalendarICS([{ game }]), /DTSTART;VALUE=DATE:20260202/);
});
test("sharing uses the actual five-star rating scale", () => {
  assert.ok(generateMarkdownList("Test", [{ game, log }]).includes("4.5/5"));
});
test("filters combine facets and require all selected tags", () => {
  const entries = [{ game, log }];
  assert.equal(
    filterEntries(entries, { status: ["Played"], rating: { min: 4 }, tagIds: ["a", "b"] }).length,
    1
  );
  assert.equal(filterEntries(entries, { tagIds: ["a", "missing"] }).length, 0);
  assert.equal(filterEntries(entries, { timeToBeat: { max: 20 } }).length, 0);
  assert.equal(filterEntries(entries, { platforms: ["Switch"] }).length, 0);
});
test("localDate uses calendar components rather than a UTC date", () => {
  const date = new Date(2026, 9, 26, 23, 30);
  assert.equal(localDate(date), "2026-10-26");
});
import { computeYearInReview } from "../src/services/yearInReview";
test("empty year in review never invents playtime, completions, genres or ratings", () => {
  const stats = computeYearInReview([], [], 2026);
  assert.equal(stats.totalHours, 0);
  assert.equal(stats.completedCount, 0);
  assert.equal(stats.activeCount, 0);
  assert.deepEqual(stats.topGenres, []);
  assert.deepEqual(stats.topRated, []);
  assert.equal(stats.favoriteDay, "Not recorded");
});
test("year in review counts dated sessions and completed games, excluding abandonment and other years", () => {
  const stats = computeYearInReview(
    [game, { ...game, igdbId: 43 }],
    [
      {
        ...log,
        completion: "Completed",
        finishedAt: "2026-01-31",
        timePlayed: 100,
        playSessions: [
          { date: "2026-01-31", durationMinutes: 120 },
          { date: "2025-01-31", durationMinutes: 600 },
        ],
      },
      {
        ...log,
        igdbId: 43,
        completion: "Abandoned",
        finishedAt: "2026-01-31",
        playSessions: [{ date: "2026-02-01", durationMinutes: 60 }],
      },
    ],
    2026
  );
  assert.equal(stats.totalHours, 3);
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.activeCount, 2);
});
import { parsePlatformList } from "../src/services/platformImport";
test("platform import preserves titles containing game and quoted commas", () => {
  assert.equal(parsePlatformList("Game of Thrones\nHades", "GOG")[0].sourceName, "Game of Thrones");
  const result = parsePlatformList(
    'Title,Hours\n"Game, With Commas",12.5h\nBaldur\'s Gate 3,4',
    "GOG"
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].sourceName, "Game, With Commas");
  assert.equal(result[0].timePlayedHours, 12.5);
  assert.equal(result[1].sourceName, "Baldur's Gate 3");
});
import { computePlayHabits } from "../src/services/playHabits";
test("play streaks use calendar days across daylight saving and ignore future sessions", () => {
  const stats = computePlayHabits(
    [
      {
        ...log,
        playSessions: ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-20"].map((date) => ({
          date,
        })),
      },
    ],
    new Date(2026, 2, 9, 12)
  );
  assert.equal(stats.maxStreak, 3);
  assert.equal(stats.currentStreak, 3);
  assert.equal(stats.heatmapData.length, 365);
  assert.deepEqual(stats.heatmapData.at(-1), { date: "2026-03-09", played: true });
});
