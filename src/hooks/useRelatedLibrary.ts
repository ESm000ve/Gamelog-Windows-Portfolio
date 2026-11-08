import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import type { Status } from "../types";
export type RelatedLibrary = Map<number, Status | undefined>;
export function useRelatedLibrary(provided?: RelatedLibrary) {
  return useLiveQuery(async () => {
    if (provided) return provided;
    return db.transaction("r", db.games, db.logs, async () => {
      const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);
      const statuses = new Map(logs.map((log) => [log.igdbId, log.status]));
      return new Map(games.map((game) => [game.igdbId, statuses.get(game.igdbId)]));
    });
  }, [provided]);
}
