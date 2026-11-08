import type { Game } from "../types";
export interface RecommendationFeedback {
  igdbId: number;
  title: string;
  genres: string[];
}
const key = "gamelog.recommendationFeedback.v1";
export function readRecommendationFeedback(): RecommendationFeedback[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (v): v is RecommendationFeedback =>
              !!v &&
              typeof v === "object" &&
              Number.isSafeInteger(v.igdbId) &&
              v.igdbId > 0 &&
              typeof v.title === "string" &&
              Array.isArray(v.genres) &&
              v.genres.every((g: unknown) => typeof g === "string")
          )
          .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
export function lessLike(
  game: Pick<Game, "igdbId" | "title" | "genres">
): RecommendationFeedback[] {
  const previous = readRecommendationFeedback();
  if (previous.some((entry) => entry.igdbId === game.igdbId)) return previous;
  if (previous.length >= 200)
    throw new Error("Review recommendation preferences before hiding more games (200 maximum).");
  const next = [
    ...previous,
    { igdbId: game.igdbId, title: game.title, genres: [...new Set(game.genres)] },
  ];
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}
export function clearRecommendationFeedback(igdbId?: number): RecommendationFeedback[] {
  const next =
    igdbId === undefined
      ? []
      : readRecommendationFeedback().filter((entry) => entry.igdbId !== igdbId);
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}
/** A modest local penalty; explicit intent can still prioritize the requested genre. */
export function feedbackPenalty(
  game: Pick<Game, "genres">,
  feedback: RecommendationFeedback[]
): number {
  const genres = new Set(feedback.flatMap((entry) => entry.genres.map((g) => g.toLowerCase())));
  return Math.min(24, new Set(game.genres.filter((g) => genres.has(g.toLowerCase()))).size * 8);
}
