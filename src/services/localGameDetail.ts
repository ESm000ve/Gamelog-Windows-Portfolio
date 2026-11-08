import type { Game } from "../types";
import { normalizeDetail, type GameDetail } from "../types/gameDetail";

/** Only saved catalog fields; missing online media and relationships stay empty. */
export function localGameDetail(game: Game): GameDetail {
  const detail = normalizeDetail(
    {
      id: game.igdbId,
      name: game.title,
      slug: game.slug,
      summary: game.summary,
      first_release_date: game.firstReleaseDate,
      genres: game.genres.map((name) => ({ name })),
      platforms: game.platforms.map((name) => ({ name })),
      involved_companies: [
        { company: { name: game.developer }, developer: true },
        ...(game.publisher ? [{ company: { name: game.publisher }, publisher: true }] : []),
      ],
    },
    game.timeToBeat ?? null
  );
  return {
    ...detail,
    releaseYear: game.releaseYear,
    coverUrl: game.coverUrl,
    igdbRating: { score: game.igdbRating },
  };
}
