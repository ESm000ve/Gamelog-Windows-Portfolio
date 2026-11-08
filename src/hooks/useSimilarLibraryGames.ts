import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import { similarityScore } from "../services/gameSimilarity";
import type { GameDetail, RelatedGameSlim } from "../types/gameDetail";
export function useSimilarLibraryGames(detail: GameDetail | null) {
  const result = useLiveQuery(async () => {
    if (!detail) return { id: 0, games: [] };
    const games = await db.games.toArray();
    const target = games.find((game) => game.igdbId === detail.igdbId) ?? { genres: detail.genres };
    const related = games
      .filter((game) => game.igdbId !== detail.igdbId)
      .map((game) => ({ game, score: similarityScore(target, game) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(
        ({ game }) =>
          ({
            id: game.igdbId,
            name: game.title,
            slug: game.slug,
            cover: game.coverUrl
              ? {
                  image_id:
                    game.coverUrl
                      .split("/")
                      .pop()
                      ?.replace(/\.[^.]+$/, "") ?? "",
                }
              : undefined,
            first_release_date:
              game.firstReleaseDate ??
              (game.releaseYear
                ? new Date(`${game.releaseYear}-01-01`).getTime() / 1000
                : undefined),
          }) satisfies RelatedGameSlim
      );
    return { id: detail.igdbId, games: related };
  }, [detail?.igdbId]);
  return result?.id === detail?.igdbId ? (result?.games ?? []) : [];
}
