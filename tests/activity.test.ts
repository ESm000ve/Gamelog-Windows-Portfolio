import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityEvents,
  selectActivity,
  summarizeActivity,
  activityCalendar,
  validActivityDate,
} from "../src/services/activity";
import { evaluateAchievements } from "../src/services/achievements";
import { computeYearInReview } from "../src/services/yearInReview";
import type { Game, Log } from "../src/types";
const now = new Date(2026, 9, 28, 12);
const game: Game = {
  igdbId: 1,
  title: "Quest",
  slug: "quest",
  developer: "Test",
  releaseYear: 2020,
  genres: ["RPG", "Role-playing (RPG)"],
  platforms: ["PC", "Switch", "PS5", "Xbox"],
  addedAt: new Date(2026, 8, 1, 12).getTime(),
  updatedAt: now.getTime(),
};
const base: Log = { igdbId: 1, status: "Backlog", createdAt: 1, updatedAt: now.getTime() };
test("library edits and ratings do not fabricate gameplay; additions survive sessions", () => {
  assert.deepEqual(
    buildActivityEvents([game], [{ ...base, rating: 5 }], now).map((e) => e.type),
    ["added"]
  );
  const events = buildActivityEvents(
    [game],
    [{ ...base, playSessions: [{ date: "2026-10-28", durationMinutes: 90 }] }],
    now
  );
  assert.equal(events.filter((e) => e.type === "added").length, 1);
  assert.equal(summarizeActivity(events).activeDays, 1);
  assert.equal(buildActivityEvents([], [base], now).length, 0);
});
test("invalid and future dates are excluded; abandonment is accurately labeled", () => {
  for (const date of ["2026-02-30", "2026-10-29", "2026-1-1", "bad"])
    assert.equal(validActivityDate(date, "2026-10-28"), false);
  const events = buildActivityEvents(
    [game],
    [
      {
        ...base,
        status: "Played",
        completion: "Abandoned",
        finishedAt: "2026-10-27",
        startedAt: "2026-02-30",
        playSessions: [{ date: "2026-10-29" }],
      },
    ],
    now
  );
  assert.equal(events.find((e) => e.type === "finished")?.title, "Stopped playing");
  assert.equal(summarizeActivity(events).completed, 0);
  assert.equal(events.length, 2);
});
test("summary counts dated sessions and known durations without lifetime hours", () => {
  const events = buildActivityEvents(
    [game],
    [
      {
        ...base,
        timePlayed: 100,
        startedAt: "2026-10-27",
        playSessions: [
          { date: "2026-10-27", durationMinutes: 90 },
          { date: "2026-10-28" },
          { date: "2026-10-28", durationMinutes: -1 },
        ],
      },
    ],
    now
  );
  const summary = summarizeActivity(events);
  assert.equal(summary.hours, 1.5);
  assert.equal(summary.sessions, 3);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.unknownDuration, 2);
  assert.equal(summary.mostLogged?.sessions, 3);
});
test("period boundaries include 30 calendar days and selected day overrides period", () => {
  const events = buildActivityEvents(
    [game],
    [
      {
        ...base,
        playSessions: [{ date: "2026-09-28" }, { date: "2026-09-29" }, { date: "2026-10-28" }],
      },
    ],
    now
  );
  assert.equal(selectActivity(events, "days30", null, now).length, 2);
  assert.equal(selectActivity(events, "month", null, now).length, 1);
  assert.equal(selectActivity(events, "month", "2026-09-28", now).length, 1);
});
test("calendar has 365 days, ignores library edits, and keeps yesterday's streak", () => {
  const events = buildActivityEvents(
    [game],
    [
      {
        ...base,
        playSessions: [{ date: "2026-10-25" }, { date: "2026-10-26" }, { date: "2026-10-27" }],
      },
    ],
    now
  );
  const calendar = activityCalendar(events, now);
  assert.equal(calendar.cells.length, 365);
  assert.equal(calendar.cells.at(-1)?.date, "2026-10-28");
  assert.equal(calendar.activeDays, 3);
  assert.equal(calendar.currentStreak, 3);
  assert.equal(calendar.bestStreak, 3);
  assert.equal(activityCalendar(events, new Date(2026, 9, 29, 12)).currentStreak, 0);
});
test("achievements exclude catalog platforms, unplayed genres and metadata days", () => {
  const achievements = evaluateAchievements([game], [base], now);
  for (const id of ["genre_explorer", "rpg_scholar", "platform_polyglot", "on_a_roll"])
    assert.equal(achievements.find((a) => a.id === id)?.current, 0);
  assert.equal(achievements.find((a) => a.id === "first_step")?.unlocked, true);
});
test("achievement totals do not double count sessions or round up a milestone", () => {
  const achievements = evaluateAchievements(
    [game],
    [
      {
        ...base,
        status: "Played",
        completion: "Completed",
        timePlayed: 49.6,
        playSessions: [{ date: "2026-10-28", durationMinutes: 120 }],
      },
    ],
    now
  );
  const hours = achievements.find((a) => a.id === "time_invested")!;
  assert.equal(hours.current, 49);
  assert.equal(hours.unlocked, false);
  assert.equal(achievements.find((a) => a.id === "rpg_scholar")?.current, 1);
  assert.equal(achievements.find((a) => a.id === "perfectionist")?.current, 0);
  assert.equal(achievements.find((a) => a.id === "backlog_conqueror")?.current, 1);
});
test("annual review excludes invalid and future sessions and accepts prior years", () => {
  const logs: Log[] = [
    {
      ...base,
      playSessions: [
        { date: "2026-02-30", durationMinutes: 120 },
        { date: "2026-12-01", durationMinutes: 120 },
        { date: "2025-10-28", durationMinutes: 60 },
      ],
    },
  ];
  assert.equal(computeYearInReview([game], logs, 2026, now).activeCount, 0);
  assert.equal(computeYearInReview([game], logs, 2025, now).totalHours, 1);
});
