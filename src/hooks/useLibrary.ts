import { countLibrary, sortLibrary, type LibrarySort } from "../services/libraryPresentation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { LibraryEntry } from "../types";
import { filterEntries, type FilterSpec } from "../services/filterEngine";

export type SortKey = LibrarySort;

interface UseLibraryOptions {
  filters?: FilterSpec;
  sort?: SortKey;
  search?: string;
}

/**
 * Reactive library hook.
 * Returns undefined while the initial IndexedDB query is loading.
 * After that, re-renders automatically on any db change.
 */
export function useLibrary({ filters = {}, sort = "recent", search = "" }: UseLibraryOptions = {}) {
  return useLiveQuery(async () => {
    const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);

    const logMap = new Map(logs.map((l) => [l.igdbId, l]));

    let entries: LibraryEntry[] = games
      .filter((g) => logMap.has(g.igdbId))
      .map((g) => ({ game: g, log: logMap.get(g.igdbId)! }));

    // Apply FilterSpec
    entries = filterEntries(entries, filters);

    // Title search
    const q = search.trim().toLowerCase();
    if (q) {
      entries = entries.filter((e) => e.game.title.toLowerCase().includes(q));
    }

    entries = sortLibrary(entries, sort);

    return entries;
  }, [JSON.stringify(filters), sort, search]);
}

/** Counts per status — used for the filter strip badges. */
export function useLibraryCounts() {
  return useLiveQuery(async () => {
    const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);
    return countLibrary(games, logs);
  });
}

/** Fetch a single LibraryEntry by igdbId. */
export function useGame(igdbId: number) {
  return useLiveQuery(async () => {
    const [game, log] = await Promise.all([db.games.get(igdbId), db.logs.get(igdbId)]);
    if (!game || !log) return null;
    return { game, log } as LibraryEntry;
  }, [igdbId]);
}
