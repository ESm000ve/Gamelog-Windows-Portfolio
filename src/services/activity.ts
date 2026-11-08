import type { Game, Log } from "../types";
import { localDate } from "../utils/dates";
export type ActivityPeriod = "all" | "month" | "year" | "days30";
export type ActivityType = "session" | "started" | "finished" | "added";
export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  date: string;
  timestamp: number;
  game: Game;
  log: Log;
  minutes?: number;
}
export function validActivityDate(value: unknown, today = localDate()): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today)
    return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export const activityDateLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export function buildActivityEvents(games: Game[], logs: Log[], now = new Date()): ActivityEvent[] {
  const today = localDate(now),
    gameMap = new Map(games.map((game) => [game.igdbId, game]));
  const events: ActivityEvent[] = [];
  for (const log of logs) {
    const game = gameMap.get(log.igdbId);
    if (!game) continue;
    const add = (
      type: ActivityType,
      date: string,
      title: string,
      description: string,
      suffix = "",
      minutes?: number
    ) =>
      events.push({
        id: `${game.igdbId}-${type}-${date}-${suffix}`,
        type,
        title,
        description,
        date,
        timestamp: new Date(date + "T12:00:00").getTime(),
        game,
        log,
        ...(minutes !== undefined ? { minutes } : {}),
      });
    if (Number.isFinite(game.addedAt) && game.addedAt >= 0 && game.addedAt <= now.getTime())
      add("added", localDate(new Date(game.addedAt)), "Added to library", "Library addition");
    if (validActivityDate(log.startedAt, today))
      add("started", log.startedAt, "Started playing", "Recorded start date");
    if (log.status === "Played" && validActivityDate(log.finishedAt, today)) {
      const label =
        log.completion === "Completed"
          ? "Completed game"
          : log.completion === "Mastered"
            ? "Mastered game"
            : log.completion === "Abandoned"
              ? "Stopped playing"
              : log.completion === "Shelved"
                ? "Shelved game"
                : "Marked Played";
      add(
        "finished",
        log.finishedAt,
        label,
        log.completion ? `Outcome: ${log.completion}` : "Finish date recorded; no outcome set"
      );
    }
    for (const [index, session] of (log.playSessions ?? []).entries())
      if (validActivityDate(session.date, today)) {
        const minutes =
          typeof session.durationMinutes === "number" &&
          Number.isFinite(session.durationMinutes) &&
          session.durationMinutes >= 0
            ? session.durationMinutes
            : undefined;
        add(
          "session",
          session.date,
          "Play session",
          minutes === undefined
            ? "Activity recorded; duration not set"
            : `${minutes.toLocaleString()} minutes recorded`,
          String(index),
          minutes
        );
      }
  }
  return events.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.game.title.localeCompare(b.game.title) ||
      a.id.localeCompare(b.id)
  );
}
export function selectActivity(
  events: ActivityEvent[],
  period: ActivityPeriod,
  date: string | null,
  now = new Date()
): ActivityEvent[] {
  if (date) return events.filter((event) => event.date === date);
  const start30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const cutoff =
    period === "month"
      ? localDate(new Date(now.getFullYear(), now.getMonth(), 1))
      : period === "year"
        ? `${now.getFullYear()}-01-01`
        : period === "days30"
          ? localDate(start30)
          : "";
  return events.filter((event) => event.date >= cutoff);
}
export const isPlayEvent = (event: ActivityEvent) => event.type !== "added";
export function summarizeActivity(events: ActivityEvent[]) {
  const play = events.filter(isPlayEvent),
    sessions = play.filter((event) => event.type === "session");
  const days = [...new Set(play.map((event) => event.date))];
  const completed = new Set(
    play
      .filter(
        (event) =>
          event.type === "finished" &&
          (event.log.completion === "Completed" || event.log.completion === "Mastered")
      )
      .map((event) => event.game.igdbId)
  );
  const gameCounts = new Map<number, { game: Game; sessions: number }>();
  for (const event of sessions) {
    const entry = gameCounts.get(event.game.igdbId) ?? { game: event.game, sessions: 0 };
    entry.sessions++;
    gameCounts.set(event.game.igdbId, entry);
  }
  const weekdayCounts = new Map<number, number>();
  for (const date of days) {
    const weekday = new Date(date + "T12:00:00").getDay();
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  }
  const bestDay = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return {
    activeDays: days.length,
    sessions: sessions.length,
    hours: Number((sessions.reduce((sum, event) => sum + (event.minutes ?? 0), 0) / 60).toFixed(1)),
    completed: completed.size,
    mostLogged:
      [...gameCounts.values()].sort(
        (a, b) => b.sessions - a.sessions || a.game.title.localeCompare(b.game.title)
      )[0] ?? null,
    bestDay: bestDay
      ? {
          label: new Date(2026, 0, 4 + bestDay[0]).toLocaleDateString(undefined, {
            weekday: "long",
          }),
          days: bestDay[1],
        }
      : null,
    unknownDuration: sessions.filter((event) => event.minutes === undefined).length,
  };
}
export function activityCalendar(events: ActivityEvent[], now = new Date()) {
  const counts = new Map<string, number>();
  for (const event of events.filter(isPlayEvent))
    counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
  const cells = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364 + index);
    const key = localDate(date);
    return { date: key, count: counts.get(key) ?? 0 };
  });
  let streak = 0,
    best = 0,
    lastActive = -Infinity,
    lastRun = 0;
  cells.forEach((cell, index) => {
    if (cell.count) {
      streak++;
      best = Math.max(best, streak);
      lastActive = index;
      lastRun = streak;
    } else streak = 0;
  });
  return {
    cells,
    leading: new Date(cells[0]!.date + "T12:00:00").getDay(),
    activeDays: cells.filter((cell) => cell.count).length,
    bestStreak: best,
    currentStreak: 364 - lastActive <= 1 ? lastRun : 0,
  };
}
