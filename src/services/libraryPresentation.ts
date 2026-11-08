import type { Game, Log, LibraryEntry, Status } from "../types";
export const LIBRARY_SORTS = [
  "recent",
  "rating",
  "title-asc",
  "title-desc",
  "year-desc",
  "year-asc",
  "time",
] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];
export function readLibraryView(value: unknown): "grid" | "table" {
  return value === "table" ? "table" : "grid";
}
export function readLibrarySort(value: unknown): LibrarySort {
  return LIBRARY_SORTS.includes(value as LibrarySort) ? (value as LibrarySort) : "recent";
}
export function loggedPlatforms(log?: Log): string[] {
  const values = log?.platforms?.length ? log.platforms : log?.platform ? [log.platform] : [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
export function countLibrary(games: Game[], logs: Log[]) {
  const ids = new Set(games.map((game) => game.igdbId));
  const counts: Record<Status | "All", number> = {
    All: 0,
    Playing: 0,
    Backlog: 0,
    Played: 0,
    Wishlist: 0,
  };
  for (const log of logs)
    if (ids.has(log.igdbId) && ["Playing", "Backlog", "Played", "Wishlist"].includes(log.status)) {
      counts.All++;
      counts[log.status]++;
    }
  return counts;
}
export function sortLibrary(entries: LibraryEntry[], sort: LibrarySort) {
  const title = (a: LibraryEntry, b: LibraryEntry) =>
    a.game.title.localeCompare(b.game.title) || a.game.igdbId - b.game.igdbId;
  const known = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const compare = (a: unknown, b: unknown, ascending = false) => {
    if (!known(a)) return known(b) ? 1 : 0;
    if (!known(b)) return -1;
    return ascending ? a - b : b - a;
  };
  const year = (entry: LibraryEntry) =>
    known(entry.game.releaseYear) &&
    entry.game.releaseYear >= 1900 &&
    entry.game.releaseYear <= 2100
      ? entry.game.releaseYear
      : undefined;
  return [...entries].sort((a, b) => {
    let difference = 0;
    if (sort === "title-asc") return title(a, b);
    if (sort === "title-desc") return -title(a, b);
    if (sort === "recent") difference = compare(a.game.addedAt, b.game.addedAt);
    if (sort === "rating") difference = compare(a.log.rating, b.log.rating);
    if (sort === "time") difference = compare(a.log.timePlayed, b.log.timePlayed);
    if (sort === "year-asc" || sort === "year-desc") {
      const ascending = sort === "year-asc";
      difference = compare(year(a), year(b), ascending);
      if (!difference && year(a) !== undefined && year(b) !== undefined)
        difference = compare(a.game.firstReleaseDate, b.game.firstReleaseDate, ascending);
    }
    return difference || title(a, b);
  });
}
