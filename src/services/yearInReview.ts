import { validActivityDate } from "./activity";
import { localDate } from "../utils/dates";
import type { Game, Log } from "../types";
/** Annual playtime includes only sessions dated within the selected year. */
export function computeYearInReview(
  games: Game[],
  logs: Log[],
  currentYear: number,
  now = new Date()
) {
  const today = localDate(now);
  const gameMap = new Map<number, Game>();
  games.forEach((g) => gameMap.set(g.igdbId, g));

  let totalHours = 0;
  let completedCount = 0;
  const activeGames = new Set<number>();
  const genreCounts = new Map<string, number>();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
  const ratedGames: { game: Game; log: Log }[] = [];

  const yearStr = String(currentYear);

  logs.forEach((log) => {
    const game = gameMap.get(log.igdbId);
    if (!game) return;

    let isActiveThisYear = false;

    // Finished this year
    if (
      log.status === "Played" &&
      validActivityDate(log.finishedAt, today) &&
      log.finishedAt.startsWith(yearStr + "-")
    ) {
      isActiveThisYear = true;
      if (
        log.status === "Played" &&
        (log.completion === "Completed" || log.completion === "Mastered")
      )
        completedCount++;
    }

    // Started this year
    if (validActivityDate(log.startedAt, today) && log.startedAt.startsWith(yearStr + "-")) {
      isActiveThisYear = true;
    }

    // Play sessions this year
    if (log.playSessions) {
      log.playSessions.forEach((s) => {
        if (validActivityDate(s.date, today) && s.date.startsWith(yearStr + "-")) {
          isActiveThisYear = true;
          if (
            typeof s.durationMinutes === "number" &&
            Number.isFinite(s.durationMinutes) &&
            s.durationMinutes >= 0
          )
            totalHours += s.durationMinutes / 60;
          const d = new Date(s.date + "T12:00:00");
          if (!isNaN(d.getDay())) dayOfWeekCounts[d.getDay()]++;
        }
      });
    }

    // Ratings
    if (
      isActiveThisYear &&
      typeof log.rating === "number" &&
      Number.isFinite(log.rating) &&
      log.rating >= 0.5 &&
      log.rating <= 5 &&
      Number.isInteger(log.rating * 2)
    ) {
      ratedGames.push({ game, log });
    }

    // If active this year, tally genres
    if (isActiveThisYear) {
      activeGames.add(log.igdbId);
      if (game.genres) {
        [...new Set(game.genres)].forEach((g) => genreCounts.set(g, (genreCounts.get(g) || 0) + 1));
      }
    }
  });

  // Top genres sorted
  const sortedGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));

  // Top rated games sorted
  const topRated = ratedGames.sort((a, b) => (b.log.rating || 0) - (a.log.rating || 0)).slice(0, 3);

  // Favorite day of week
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let maxDayIdx = 5; // Default Friday
  let maxDayVal = 0;
  dayOfWeekCounts.forEach((val, idx) => {
    if (val > maxDayVal) {
      maxDayVal = val;
      maxDayIdx = idx;
    }
  });

  // Gamer Persona
  let personaTitle = "The Journal Keeper";
  let personaDesc = "You’re building a record of the games you play.";

  if (completedCount >= 8) {
    personaTitle = "The Completionist Sentinel";
    personaDesc =
      "You stop at nothing until every credit roll is witnessed and every quest is conquered.";
  } else if (
    sortedGenres[0]?.name.toLowerCase().includes("role-playing") ||
    sortedGenres[0]?.name.toLowerCase() === "rpg"
  ) {
    personaTitle = "The RPG Connoisseur";
    personaDesc =
      "You live for massive skill trees, character builds, and sweeping narrative epics.";
  } else if (genreCounts.size >= 5) {
    personaTitle = "The Eclectic Explorer";
    personaDesc = "No genre is off-limits; your gaming palate is boundless and adventurous.";
  } else if (totalHours >= 80) {
    personaTitle = "The Dedicated Champion";
    personaDesc = "When a virtual world calls your name, you answer with devotion and mastery.";
  }

  if (activeGames.size === 0) {
    personaTitle = "Your story starts here";
    personaDesc = "Log your gameplay to discover your yearly patterns.";
  }
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    completedCount,
    activeCount: activeGames.size,
    topGenres: sortedGenres,
    topRated,
    favoriteDay: maxDayVal > 0 ? days[maxDayIdx] : "Not recorded",
    personaTitle,
    personaDesc,
  };
}
