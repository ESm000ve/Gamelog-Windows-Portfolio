import type { Game, Log, LibraryEntry } from "../types";
import { localDate } from "../utils/dates";
import { validActivityDate, activityDateLabel } from "./activity";
export type PlayPool = "ready" | "backlog" | "playing" | "revisit";
export const PLAY_POOLS: { value: PlayPool; label: string }[] = [
  { value: "ready", label: "All ready to play" },
  { value: "backlog", label: "Backlog" },
  { value: "playing", label: "Currently playing" },
  { value: "revisit", label: "Ready to revisit" },
];
export function lastPlayedDate(log: Log, now = new Date()): string | undefined {
  const today = localDate(now);
  return [log.startedAt, log.finishedAt, ...(log.playSessions ?? []).map((session) => session.date)]
    .filter((date): date is string => validActivityDate(date, today))
    .sort()
    .at(-1);
}
export function replayCutoff(now = new Date()) {
  // Calendar anniversary, clamped for February 29. A year means a calendar year.
  const year = now.getFullYear() - 1,
    month = now.getMonth();
  const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
  return localDate(new Date(year, month, day));
}
export function readyToReplay(log: Log, now = new Date()) {
  if (log.status !== "Played") return false;
  const latest = lastPlayedDate(log, now);
  return latest === undefined || latest < replayCutoff(now);
}
export interface PlayFilters {
  pool?: PlayPool;
  maxHours?: number;
}
export function eligiblePlayEntries(
  games: Game[],
  logs: Log[],
  filters: PlayFilters = {},
  now = new Date()
): LibraryEntry[] {
  const byId = new Map(logs.map((log) => [log.igdbId, log]));
  return games.flatMap((game) => {
    const log = byId.get(game.igdbId);
    if (!log || log.status === "Wishlist") return [];
    const matches =
      filters.pool === "backlog"
        ? log.status === "Backlog"
        : filters.pool === "playing"
          ? log.status === "Playing"
          : filters.pool === "revisit"
            ? readyToReplay(log, now)
            : log.status === "Backlog" || log.status === "Playing" || readyToReplay(log, now);
    if (!matches) return [];
    const hours = game.timeToBeat?.finish;
    if (
      filters.maxHours !== undefined &&
      !(
        typeof hours === "number" &&
        Number.isFinite(hours) &&
        hours > 0 &&
        hours <= filters.maxHours
      )
    )
      return [];
    return [{ game, log }];
  });
}
export function playReason(log: Log, now = new Date()) {
  if (log.status === "Backlog") return "Waiting in your backlog";
  if (log.status === "Playing") return "Continue a game you are playing";
  const date = lastPlayedDate(log, now);
  return date
    ? `Last recorded play: ${activityDateLabel(date)}`
    : "Played before · no play date recorded";
}
export function drawPlayPick(
  entries: LibraryEntry[],
  seen: ReadonlySet<number>,
  lastId?: number,
  random = Math.random
) {
  let candidates = entries.filter((entry) => !seen.has(entry.game.igdbId));
  const reset = !candidates.length;
  if (reset)
    candidates =
      entries.length > 1 ? entries.filter((entry) => entry.game.igdbId !== lastId) : entries;
  if (!candidates.length) return null;
  const value = Math.min(0.999999999, Math.max(0, random()));
  return { entry: candidates[Math.floor(value * candidates.length)], reset };
}
export function readPlayPreferences(raw: string | null): {
  pool: PlayPool;
  maxHours?: number;
  intent: string;
} {
  try {
    const value = JSON.parse(raw ?? "{}");
    return {
      pool: PLAY_POOLS.some((pool) => pool.value === value?.pool) ? value.pool : "ready",
      maxHours: [5, 10, 20, 40].includes(value?.maxHours) ? value.maxHours : undefined,
      intent: typeof value?.intent === "string" ? value.intent.slice(0, 500) : "",
    };
  } catch {
    return { pool: "ready", intent: "" };
  }
}
