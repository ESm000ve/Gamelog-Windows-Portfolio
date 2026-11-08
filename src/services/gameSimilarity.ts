import { db } from "../db/schema";
import { embed, cosineSimilarity } from "./ai";
import { EMBEDDING_MODEL, validVector } from "./aiContracts";
import type { Game } from "../types";
export const embeddingText = (game: Pick<Game, "title" | "genres" | "summary">) =>
  `${game.title}\nGenres: ${game.genres.join(", ")}\n${game.summary ?? ""}`.slice(0, 8000);
export function similarityScore(
  a: Pick<Game, "genres" | "embedding" | "embeddingModel">,
  b: Pick<Game, "genres" | "embedding" | "embeddingModel">
): number {
  if (
    a.embeddingModel === EMBEDDING_MODEL &&
    b.embeddingModel === EMBEDDING_MODEL &&
    validVector(a.embedding) &&
    validVector(b.embedding)
  )
    return Math.max(0, cosineSimilarity(a.embedding, b.embedding));
  const left = new Set(a.genres),
    right = new Set(b.genres);
  const intersection = [...left].filter((genre) => right.has(genre)).length;
  return intersection ? intersection / new Set([...left, ...right]).size : 0;
}
export async function prepareGameMatches(
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal
) {
  const games = await db.games.toArray();
  const missing = games.filter(
    (game) => game.embeddingModel !== EMBEDDING_MODEL || !validVector(game.embedding)
  );
  let done = 0;
  onProgress(done, missing.length);
  for (const game of missing) {
    signal.throwIfAborted();
    const input = embeddingText(game);
    const embedding = await embed(input, signal);
    signal.throwIfAborted();
    await db.transaction("rw", db.games, async () => {
      const current = await db.games.get(game.igdbId);
      if (current && embeddingText(current) === input)
        await db.games.update(game.igdbId, { embedding, embeddingModel: EMBEDDING_MODEL });
    });
    onProgress(++done, missing.length);
  }
  return done;
}
