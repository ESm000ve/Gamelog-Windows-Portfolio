import type { Game, Log } from "../types";

export interface TasteAggregates {
  totalGames: number;
  totalRated: number;
  ratingSamplesByGenre: Record<string, number>;
  ratingSamplesByLength: Record<string, number>;
  ratingSamplesByPlatform: Record<string, number>;
  totalCompleted: number;
  totalAbandoned: number;
  avgRatingByLength: Record<string, number>;
  avgRatingByGenre: Record<string, number>;
  avgRatingByPlatform: Record<string, number>;
  completionRateByLength: Record<string, { completed: number; abandoned: number; rate: number }>;
  completionRateByGenre: Record<string, { completed: number; abandoned: number; rate: number }>;
  wishlistedVsPlayedGenres: Record<string, { wishlisted: number; played: number }>;
}

function getLengthBucket(hours: number): string {
  if (hours < 10) return "<10h";
  if (hours < 30) return "10-30h";
  if (hours < 60) return "30-60h";
  return "60h+";
}

export function computeTasteAggregates(games: Game[], logs: Log[]): TasteAggregates {
  const gameMap = new Map<number, Game>(games.map((g) => [g.igdbId, g]));

  const aggs = {
    totalGames: games.length,
    totalRated: 0,
    totalCompleted: 0,
    totalAbandoned: 0,

    // accumulators
    _ratingByLength: {} as Record<string, { sum: number; count: number }>,
    _ratingByGenre: {} as Record<string, { sum: number; count: number }>,
    _ratingByPlatform: {} as Record<string, { sum: number; count: number }>,

    _compByLength: {} as Record<string, { completed: number; abandoned: number }>,
    _compByGenre: {} as Record<string, { completed: number; abandoned: number }>,

    wishlistedVsPlayedGenres: {} as Record<string, { wishlisted: number; played: number }>,
  };

  logs.forEach((log) => {
    const game = gameMap.get(log.igdbId);
    if (!game) return;

    const isCompleted =
      log.status === "Played" && (log.completion === "Completed" || log.completion === "Mastered");
    const isAbandoned = log.status === "Played" && log.completion === "Abandoned";

    if (isCompleted) aggs.totalCompleted++;
    if (isAbandoned) aggs.totalAbandoned++;

    // Wishlist vs Played
    [...new Set(game.genres)].forEach((g) => {
      if (!aggs.wishlistedVsPlayedGenres[g])
        aggs.wishlistedVsPlayedGenres[g] = { wishlisted: 0, played: 0 };
      if (log.status === "Wishlist") aggs.wishlistedVsPlayedGenres[g].wishlisted++;
      if (log.status === "Played") aggs.wishlistedVsPlayedGenres[g].played++;
    });

    // Use the game's estimated length. Time spent before abandonment is not game length.
    let bucket = "";
    if (
      typeof game.timeToBeat?.finish === "number" &&
      Number.isFinite(game.timeToBeat.finish) &&
      game.timeToBeat.finish > 0
    ) {
      bucket = getLengthBucket(game.timeToBeat.finish);

      // Completion by length
      if (!aggs._compByLength[bucket]) aggs._compByLength[bucket] = { completed: 0, abandoned: 0 };
      if (isCompleted) aggs._compByLength[bucket].completed++;
      if (isAbandoned) aggs._compByLength[bucket].abandoned++;
    }

    // Completion by genre
    [...new Set(game.genres)].forEach((g) => {
      if (!aggs._compByGenre[g]) aggs._compByGenre[g] = { completed: 0, abandoned: 0 };
      if (isCompleted) aggs._compByGenre[g].completed++;
      if (isAbandoned) aggs._compByGenre[g].abandoned++;
    });

    // Ratings
    if (
      typeof log.rating === "number" &&
      Number.isFinite(log.rating) &&
      log.rating >= 0.5 &&
      log.rating <= 5
    ) {
      aggs.totalRated++;
      const r = log.rating;

      // Rating by length
      if (bucket) {
        if (!aggs._ratingByLength[bucket]) aggs._ratingByLength[bucket] = { sum: 0, count: 0 };
        aggs._ratingByLength[bucket].sum += r;
        aggs._ratingByLength[bucket].count++;
      }

      // Rating by genre
      [...new Set(game.genres)].forEach((g) => {
        if (!aggs._ratingByGenre[g]) aggs._ratingByGenre[g] = { sum: 0, count: 0 };
        aggs._ratingByGenre[g].sum += r;
        aggs._ratingByGenre[g].count++;
      });

      // Rating by platform
      const platforms = log.platforms?.length ? log.platforms : log.platform ? [log.platform] : [];
      [...new Set(platforms)].forEach((p) => {
        if (!aggs._ratingByPlatform[p]) aggs._ratingByPlatform[p] = { sum: 0, count: 0 };
        aggs._ratingByPlatform[p].sum += r;
        aggs._ratingByPlatform[p].count++;
      });
    }
  });

  // Finalize averages and rates
  const finalizeAverages = (source: Record<string, { sum: number; count: number }>) => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(source)) {
      if (v.count >= 2) {
        // Need at least 2 entries to be somewhat meaningful
        result[k] = Number((v.sum / v.count).toFixed(2));
      }
    }
    return result;
  };

  const finalizeRates = (source: Record<string, { completed: number; abandoned: number }>) => {
    const result: Record<string, { completed: number; abandoned: number; rate: number }> = {};
    for (const [k, v] of Object.entries(source)) {
      const total = v.completed + v.abandoned;
      if (total >= 2) {
        result[k] = { ...v, rate: Number((v.completed / total).toFixed(2)) };
      }
    }
    return result;
  };

  return {
    totalGames: aggs.totalGames,
    totalRated: aggs.totalRated,
    ratingSamplesByGenre: Object.fromEntries(
      Object.entries(aggs._ratingByGenre).map(([key, value]) => [key, value.count])
    ),
    ratingSamplesByLength: Object.fromEntries(
      Object.entries(aggs._ratingByLength).map(([key, value]) => [key, value.count])
    ),
    ratingSamplesByPlatform: Object.fromEntries(
      Object.entries(aggs._ratingByPlatform).map(([key, value]) => [key, value.count])
    ),
    totalCompleted: aggs.totalCompleted,
    totalAbandoned: aggs.totalAbandoned,
    avgRatingByLength: finalizeAverages(aggs._ratingByLength),
    avgRatingByGenre: finalizeAverages(aggs._ratingByGenre),
    avgRatingByPlatform: finalizeAverages(aggs._ratingByPlatform),
    completionRateByLength: finalizeRates(aggs._compByLength),
    completionRateByGenre: finalizeRates(aggs._compByGenre),
    wishlistedVsPlayedGenres: aggs.wishlistedVsPlayedGenres,
  };
}
