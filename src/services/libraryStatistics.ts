import type { Game, Log } from "../types";
import { localDate } from "../utils/dates";
export type StatisticsRange = "all" | "year" | "months12";

/** Date-only comparisons avoid shifting a recorded finish into the previous local day. */
export function recordedFinish(log: Log, today: string): string | null {
  const value = log.finishedAt;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return null;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function computeLibraryStatistics(
  games: Game[],
  logs: Log[],
  range: StatisticsRange,
  now = new Date()
) {
  const today = localDate(now);
  const yearStart = `${now.getFullYear()}-01-01`;
  const previousYear = now.getFullYear() - 1;
  const anniversary = new Date(
    previousYear,
    now.getMonth(),
    Math.min(now.getDate(), new Date(previousYear, now.getMonth() + 1, 0).getDate())
  );
  const cutoff = range === "year" ? yearStart : localDate(anniversary);
  const gameMap = new Map(games.map((game) => [game.igdbId, game]));
  const validLogs = logs.filter((log) => gameMap.has(log.igdbId));
  const filteredLogs = validLogs.filter((log) => {
    if (range === "all") return true;
    const finish = recordedFinish(log, today);
    return log.status === "Played" && finish !== null && finish >= cutoff;
  });
  const statusCounts = { Played: 0, Backlog: 0, Wishlist: 0, Playing: 0 };
  for (const log of validLogs) statusCounts[log.status]++;
  const ratingChartData = Array.from({ length: 10 }, (_, i) => ({
    label: String((i + 1) / 2),
    value: 0,
  }));
  const platformCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};
  let hoursPlayed = 0,
    ratingSum = 0,
    ratingCount = 0;
  for (const log of filteredLogs) {
    if (Number.isFinite(log.timePlayed) && log.timePlayed! >= 0) hoursPlayed += log.timePlayed!;
    if (
      typeof log.rating === "number" &&
      Number.isFinite(log.rating) &&
      log.rating >= 0.5 &&
      log.rating <= 5 &&
      Number.isInteger(log.rating * 2)
    ) {
      ratingSum += log.rating;
      ratingCount++;
      ratingChartData[log.rating * 2 - 1]!.value++;
    }
    // Catalog availability is not evidence of a personal platform choice.
    const platforms = log.platforms?.length
      ? log.platforms
      : log.platform
        ? [log.platform]
        : ["Not recorded"];
    for (const platform of new Set(platforms))
      platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
    for (const genre of new Set(gameMap.get(log.igdbId)!.genres))
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
  }
  const top = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 5);
  const finishesByMonth = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const prefix = localDate(month).slice(0, 7);
    return {
      label: month.toLocaleString("default", { month: "short", year: "2-digit" }),
      value: validLogs.filter(
        (log) => log.status === "Played" && recordedFinish(log, today)?.startsWith(prefix)
      ).length,
    };
  });
  return {
    totalGames: games.length,
    selectedGames: filteredLogs.length,
    hoursPlayed: Number(hoursPlayed.toFixed(1)),
    avgRating: ratingCount ? (ratingSum / ratingCount).toFixed(1) : "—",
    playedThisYear: validLogs.filter(
      (log) => log.status === "Played" && (recordedFinish(log, today) ?? "") >= yearStart
    ).length,
    statusCounts,
    ratingChartData,
    platformChartData: top(platformCounts),
    genreChartData: top(genreCounts),
    finishesByMonth,
    highlights: computeHighlights(gameMap, validLogs, filteredLogs, now),
  };
}

function computeHighlights(gameMap: Map<number, Game>, allLogs: Log[], selected: Log[], now: Date) {
  const entries = selected.map((log) => ({ game: gameMap.get(log.igdbId)!, log }));
  const mostPlayed = entries
    .filter(
      ({ log }) =>
        typeof log.timePlayed === "number" && Number.isFinite(log.timePlayed) && log.timePlayed > 0
    )
    .map(({ game, log }) => ({ game, value: log.timePlayed! }))
    .sort((a, b) => b.value - a.value || a.game.title.localeCompare(b.game.title));
  const favorites = entries
    .filter(
      ({ log }) =>
        typeof log.rating === "number" &&
        Number.isFinite(log.rating) &&
        log.rating >= 0.5 &&
        log.rating <= 5 &&
        Number.isInteger(log.rating * 2)
    )
    .map(({ game, log }) => ({ game, value: log.rating! }))
    .sort((a, b) => b.value - a.value || a.game.title.localeCompare(b.game.title));
  const played = selected.filter((log) => log.status === "Played");
  const outcomes = { Completed: 0, Mastered: 0, Abandoned: 0, Shelved: 0, "Not recorded": 0 };
  for (const log of played) {
    if (log.completion && Object.hasOwn(outcomes, log.completion)) outcomes[log.completion]++;
    else outcomes["Not recorded"]++;
  }
  const knownOutcomes = played.length - outcomes["Not recorded"];
  const completed = outcomes.Completed + outcomes.Mastered;
  const decades: Record<string, number> = {};
  for (const { game } of entries) {
    const label =
      Number.isInteger(game.releaseYear) && game.releaseYear >= 1900 && game.releaseYear <= 9999
        ? `${Math.floor(game.releaseYear / 10) * 10}s`
        : "Not recorded";
    decades[label] = (decades[label] ?? 0) + 1;
  }
  const backlog = allLogs
    .filter((log) => log.status === "Backlog")
    .map((log) => gameMap.get(log.igdbId)!)
    .filter(
      (game) => Number.isFinite(game.addedAt) && game.addedAt >= 0 && game.addedAt <= now.getTime()
    )
    .sort((a, b) => a.addedAt - b.addedAt || a.title.localeCompare(b.title));
  const oldest = backlog[0];
  // Calendar-day arithmetic avoids 23/25-hour daylight-saving days changing the age.
  const day = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  return {
    mostPlayed: mostPlayed.slice(0, 3),
    hoursRecordedCount: mostPlayed.length,
    favorites: favorites.slice(0, 3),
    ratedCount: favorites.length,
    completion: {
      completed,
      knownOutcomes,
      unspecified: outcomes["Not recorded"],
      rate: knownOutcomes ? Math.round((completed / knownOutcomes) * 100) : null,
    },
    outcomeData: Object.entries(outcomes).map(([label, value]) => ({ label, value })),
    decadeData: Object.entries(decades)
      .sort(([a], [b]) =>
        a === "Not recorded" ? 1 : b === "Not recorded" ? -1 : a.localeCompare(b)
      )
      .map(([label, value]) => ({ label, value })),
    oldestBacklog: oldest ? { game: oldest, days: day(now) - day(new Date(oldest.addedAt)) } : null,
  };
}
