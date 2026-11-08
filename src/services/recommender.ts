import { eligiblePlayEntries, playReason, type PlayPool } from "./playEligibility";
import { readRecommendationFeedback, feedbackPenalty } from "./recommendationFeedback";
import { db } from "../db/schema";
import { aiRequest, cosineSimilarity } from "./ai";
import { EMBEDDING_MODEL, validVector, readPicks } from "./aiContracts";
import type { Game, Log } from "../types";
export interface RecommenderCandidate {
  game: Game;
  log: Log;
  score: number;
  similarity?: number;
  matchedGame?: Game;
  reason?: string;
  signals?: RecommendSignal[];
}
export type RecommendSignal = {
  type: "genre" | "similar" | "rating" | "length" | "intent" | "activity";
  label: string;
};
export interface RecommendationOptions {
  maxHours?: number;
  pool?: PlayPool;
  requestAi?: boolean;
  signal?: AbortSignal;
}
export interface RecommendationResult {
  picks: RecommenderCandidate[];
  mode: "local" | "ai";
  message: string;
}
const compatible = (game: Game) =>
  game.embeddingModel === EMBEDDING_MODEL && validVector(game.embedding);
export async function preRankCandidates(
  excludeIds: number[] = [],
  options: RecommendationOptions = {}
): Promise<RecommenderCandidate[]> {
  const feedback = readRecommendationFeedback();
  const hidden = new Set(feedback.map((entry) => entry.igdbId));
  const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);
  const logMap = new Map(logs.map((log) => [log.igdbId, log]));
  const topRated = games.filter(
    (game) =>
      logMap.get(game.igdbId)?.status !== "Wishlist" && (logMap.get(game.igdbId)?.rating ?? 0) >= 4
  );
  return eligiblePlayEntries(games, logs, options)
    .map((entry) => entry.game)
    .filter((game) => !hidden.has(game.igdbId) && !excludeIds.includes(game.igdbId))
    .map((game) => {
      let maxSim = 0,
        matchedGame: Game | undefined,
        genreMatches = 0;
      for (const top of topRated) {
        if (top.igdbId === game.igdbId) continue;
        genreMatches = Math.max(
          genreMatches,
          game.genres.filter((genre) => top.genres.includes(genre)).length
        );
        if (compatible(game) && compatible(top)) {
          const similarity = cosineSimilarity(game.embedding!, top.embedding!);
          if (similarity > maxSim) {
            maxSim = similarity;
            matchedGame = top;
          }
        }
      }
      const signals: RecommendSignal[] = [
        { type: "activity", label: playReason(logMap.get(game.igdbId)!) },
      ];
      if (matchedGame)
        signals.push({
          type: "similar",
          label: `Similar to ${matchedGame.title}, rated ${logMap.get(matchedGame.igdbId)?.rating}/5`,
        });
      else if (genreMatches > 0)
        signals.push({ type: "genre", label: "Shares genres with your highly rated games" });
      if (game.igdbRating && game.igdbRating >= 80)
        signals.push({ type: "rating", label: `${Math.round(game.igdbRating)}% on IGDB` });
      if (game.timeToBeat?.finish && game.timeToBeat.finish > 0)
        signals.push({
          type: "length",
          label: `About ${Math.round(game.timeToBeat.finish)}h main story`,
        });
      return {
        game,
        log: logMap.get(game.igdbId)!,
        score:
          maxSim * 100 +
          Math.min(genreMatches, 3) * 8 +
          (game.igdbRating ?? 0) / 10 -
          feedbackPenalty(game, feedback),
        similarity: maxSim,
        matchedGame,
        signals,
      };
    })
    .sort((a, b) => b.score - a.score || a.game.title.localeCompare(b.game.title));
}
export function buildLocalReason(candidate: RecommenderCandidate): string {
  const parts = candidate.signals?.map((signal) => signal.label) ?? [];
  if (!parts.length && candidate.game.genres.length)
    parts.push(candidate.game.genres.slice(0, 2).join(" / "));
  return parts.length ? parts.slice(0, 4).join(" · ") : "A game in your selected play pool.";
}
function scoreIntent(candidates: RecommenderCandidate[], intent: string): RecommenderCandidate[] {
  const q = intent.toLowerCase().trim();
  if (!q) return candidates;
  const genres = [
    "rpg",
    "action",
    "adventure",
    "strategy",
    "simulation",
    "sports",
    "puzzle",
    "indie",
    "shooter",
    "platform",
    "fighting",
    "racing",
    "arcade",
    "music",
    "tactical",
  ];
  const wanted = genres.filter((genre) => q.includes(genre));
  return candidates
    .map((candidate) => {
      let score = candidate.score;
      if (
        wanted.some((genre) => candidate.game.genres.some((g) => g.toLowerCase().includes(genre)))
      )
        score += 80;
      const hours = candidate.game.timeToBeat?.finish;
      if (/\b(short|quick)\b/.test(q) && hours) score += hours <= 10 ? 40 : -40;
      if (/\b(long|epic)\b/.test(q) && hours) score += hours >= 30 ? 40 : -40;
      if (candidate.game.title.toLowerCase().includes(q)) score += 100;
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score);
}
export async function getRecommendations(
  intent: string,
  excludeIds: number[] = [],
  options: RecommendationOptions = {}
): Promise<RecommendationResult> {
  // Explicit hour constraints apply before shortlisting, including local fallback.
  const budget = intent.match(
    /(?:under|less than|up to|at most)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i
  );
  const parsedBudget = budget ? Number(budget[1]) : undefined;
  const maxHours =
    parsedBudget === undefined
      ? options.maxHours
      : Math.min(options.maxHours ?? Infinity, parsedBudget);
  const ranked = scoreIntent(await preRankCandidates(excludeIds, { ...options, maxHours }), intent);
  options.signal?.throwIfAborted();
  const local = ranked.slice(0, 5).map((pick) => ({ ...pick, reason: buildLocalReason(pick) }));
  const message =
    maxHours !== undefined
      ? "Only games with known main-story estimates within your limit are shown."
      : "Local picks use your ratings, genres and available game metadata.";
  if (!ranked.length || !options.requestAi) return { picks: local, mode: "local", message };
  const candidates = ranked.slice(0, 20);
  try {
    const data = await aiRequest(
      "recommend",
      {
        intent:
          intent.trim() ||
          "Choose from these games using the supplied taste signals. Give grounded, spoiler-free reasons.",
        candidates: candidates.map((c) => ({
          id: c.game.igdbId,
          title: c.game.title,
          genres: c.game.genres,
          timeToBeat: c.game.timeToBeat?.finish,
          igdbRating: c.game.igdbRating,
          signals: c.signals?.map((s) => s.label),
        })),
      },
      options.signal
    );
    options.signal?.throwIfAborted();
    const picks = readPicks(data, new Set(candidates.map((c) => c.game.igdbId)));
    if (picks.length)
      return {
        picks: picks.map((pick) => ({
          ...candidates.find((c) => c.game.igdbId === pick.id)!,
          reason: pick.reason,
        })),
        mode: "ai",
        message:
          "AI-refined suggestions. Reasons may be imperfect; the badges show known game details.",
      };
    throw new Error("AI returned no usable picks.");
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return {
      picks: local,
      mode: "local",
      message:
        (error instanceof Error ? error.message : "AI is unavailable.") +
        " Showing local picks; mood details may not match exactly.",
    };
  }
}
export async function getTasteProfile() {
  const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);
  const logMap = new Map(logs.map((log) => [log.igdbId, log]));
  const rated = games.filter((game) => {
    const rating = logMap.get(game.igdbId)?.rating;
    return typeof rating === "number" && Number.isFinite(rating) && rating >= 0.5 && rating <= 5;
  });
  const topRated = rated.filter((game) => logMap.get(game.igdbId)!.rating! >= 4);
  const genreCounts: Record<string, number> = {};
  for (const game of topRated)
    for (const genre of new Set(game.genres)) genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));
  const avgRating = rated.length
    ? rated.reduce((sum, game) => sum + logMap.get(game.igdbId)!.rating!, 0) / rated.length
    : 0;
  const topRatedGames = topRated
    .map((game) => ({
      title: game.title,
      rating: logMap.get(game.igdbId)!.rating!,
      coverUrl: game.coverUrl,
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);
  const backlogCount = games.filter((game) => logMap.get(game.igdbId)?.status === "Backlog").length;
  return { topGenres, topRatedCount: topRated.length, backlogCount, avgRating, topRatedGames };
}
