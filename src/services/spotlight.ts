import { db } from "../db/schema";
import type { Game, Log } from "../types";

export interface SpotlightData {
  game: Game;
  log: Log;
  reason: string;
}

/**
 * Returns a string representing the current ISO week (e.g., "2026-W28")
 */
function getWeekString() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo}`;
}

/**
 * Retrieves the current Game of the Week.
 * If one hasn't been picked for this week, it picks a random backlog game
 * and caches the selection in localStorage.
 */
export async function getSpotlight(): Promise<SpotlightData | null> {
  const currentWeek = getWeekString();
  const cachedWeek = localStorage.getItem("spotlight_week");
  const cachedId = localStorage.getItem("spotlight_igdbId");

  let targetId = cachedWeek === currentWeek && cachedId ? Number(cachedId) : NaN;
  let log =
    Number.isSafeInteger(targetId) && targetId > 0 ? await db.logs.get(targetId) : undefined;
  let game = log ? await db.games.get(targetId) : undefined;
  if (!log || log.status !== "Backlog" || !game) {
    const backlogLogs = (await db.logs.toArray()).filter((entry) => entry.status === "Backlog");
    if (!backlogLogs.length) return null;
    log = backlogLogs[Math.floor(Math.random() * backlogLogs.length)];
    targetId = log.igdbId;
    game = await db.games.get(targetId);
    if (!game) return null;
    localStorage.setItem("spotlight_week", currentWeek);
    localStorage.setItem("spotlight_igdbId", String(targetId));
  }

  // Generate a heuristic reason to play this game
  let reason = "It's time to finally tackle this from your backlog!";

  if (game.igdbRating && game.igdbRating >= 85) {
    reason = `Community rating: ${Math.round(game.igdbRating)}/100.`;
  } else if (game.timeToBeat?.finish && game.timeToBeat.finish < 10) {
    reason = `At roughly ${game.timeToBeat.finish} hours to beat, this is a perfect short experience for the weekend.`;
  } else if (log.createdAt && Date.now() - log.createdAt > 1000 * 60 * 60 * 24 * 180) {
    reason = "This has been sitting in your backlog for over 6 months. It's time!";
  } else if (game.genres && game.genres.length > 0) {
    reason = `Get your ${game.genres[0]} fix in. Let's start this adventure!`;
  }

  return { game, log, reason };
}
