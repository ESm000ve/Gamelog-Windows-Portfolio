import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { LibraryEntry, Game, Log } from "../types";

/** All lists, sorted by creation date (newest first). */
export function useLists() {
  return useLiveQuery(() => db.lists.orderBy("createdAt").reverse().toArray());
}

/** A single list by id. */
export function useList(id: string) {
  return useLiveQuery(() => db.lists.get(id), [id]);
}

/** Resolve a list's gameIds into full LibraryEntry objects, preserving order. */
export function useListEntries(gameIds: number[]) {
  return useLiveQuery(async () => {
    if (gameIds.length === 0) return [];
    const [games, logs] = await Promise.all([
      db.games.where("igdbId").anyOf(gameIds).toArray(),
      db.logs.where("igdbId").anyOf(gameIds).toArray(),
    ]);
    const gameMap = new Map<number, Game>(games.map((g) => [g.igdbId, g]));
    const logMap = new Map<number, Log>(logs.map((l) => [l.igdbId, l]));

    // Preserve the list order
    return gameIds
      .map((id) => {
        const game = gameMap.get(id);
        const log = logMap.get(id);
        if (!game || !log) return null;
        return { game, log } as LibraryEntry;
      })
      .filter((e): e is LibraryEntry => e !== null);
  }, [gameIds.join(",")]);
}
