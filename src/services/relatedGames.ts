import { titleMatch } from "./titleSearch";
import { relatedCategory } from "./gameClassification";
import type { RelatedGameSlim, GameDetail } from "../types/gameDetail";
export type RelatedSort = "catalog" | "name" | "newest" | "oldest";
export type RelatedScope = "all" | "in" | "new";
export type RelatedType = "all" | "games" | "versions" | "addons" | "bundles" | "other" | "unknown";
export const GAME_TYPE_LABELS: Record<number, string> = {
  0: "Full game",
  1: "DLC",
  2: "Expansion",
  3: "Bundle",
  4: "Standalone expansion",
  5: "Mod",
  6: "Episode",
  7: "Season",
  8: "Remake",
  9: "Remaster",
  10: "Expanded edition",
  11: "Port",
  12: "Fork",
  13: "Pack",
  14: "Update",
};
export const gameTypeLabel = (game: RelatedGameSlim) => {
  const category = relatedCategory(game);
  return category === undefined
    ? "Not classified"
    : (GAME_TYPE_LABELS[category] ?? "Not classified");
};
function matchesType(game: RelatedGameSlim, type: RelatedType = "all") {
  if (type === "all") return true;
  const category = relatedCategory(game);
  if (type === "unknown") return category === undefined || !GAME_TYPE_LABELS[category];
  if (category === undefined) return false;
  return type === "games"
    ? [0, 4].includes(category)
    : type === "versions"
      ? [8, 9, 10, 11].includes(category)
      : type === "addons"
        ? [1, 2].includes(category)
        : type === "bundles"
          ? category === 3
          : [5, 6, 7, 12, 13, 14].includes(category);
}
export { searchTitle, titleMatch } from "./titleSearch";
export function defaultSeriesGroup(detail: GameDetail) {
  return detail.seriesGroups?.some((group) => group.kind === "collection") ? "collections" : "all";
}
export function resolveSeriesGroup(detail: GameDetail, value: string | null) {
  return value === "all" ||
    (value === "collections" && defaultSeriesGroup(detail) === "collections") ||
    detail.seriesGroups?.some((group) => group.id === value)
    ? value!
    : defaultSeriesGroup(detail);
}
export function seriesGroupGames(detail: GameDetail, group: string) {
  if (group === "all") return detail.related.series;
  const selected =
    detail.seriesGroups?.filter((item) =>
      group === "collections" ? item.kind === "collection" : item.id === group
    ) ?? [];
  const ids = new Set(selected.flatMap((item) => item.gameIds));
  return detail.related.series.filter((game) => ids.has(game.id));
}
export interface RelatedBrowse {
  query: string;
  sort: RelatedSort;
  scope: RelatedScope;
  type?: RelatedType;
}
export function readRelatedBrowse(params: URLSearchParams): RelatedBrowse {
  const type = params.get("type");
  const sort = params.get("sort"),
    scope = params.get("library");
  return {
    query: params.get("q") ?? "",
    sort: sort === "name" || sort === "newest" || sort === "oldest" ? sort : "catalog",
    scope: scope === "in" || scope === "new" ? scope : "all",
    ...(["games", "versions", "addons", "bundles", "other", "unknown"].includes(type ?? "")
      ? { type: type as RelatedType }
      : {}),
  };
}
export function cleanRelatedGames(games: RelatedGameSlim[], sourceId: number, mainOnly = false) {
  const result = new Map<number, RelatedGameSlim>();
  for (const game of games) {
    if (
      !game ||
      !Number.isSafeInteger(game.id) ||
      game.id <= 0 ||
      game.id === sourceId ||
      typeof game.name !== "string" ||
      !game.name.trim() ||
      result.has(game.id)
    )
      continue;
    const category = relatedCategory(game);
    if (mainOnly && [1, 2, 3, 5, 6, 7, 12].includes(category ?? 0)) continue;
    const date = releaseTime(game);
    result.set(game.id, { ...game, category, name: game.name.trim(), first_release_date: date });
  }
  return [...result.values()];
}
export function browseRelated(
  games: RelatedGameSlim[],
  state: RelatedBrowse,
  libraryIds: ReadonlySet<number>
) {
  const query = state.query.trim();
  const filtered = games.filter(
    (game) =>
      titleMatch(game.name, query) !== undefined &&
      matchesType(game, state.type) &&
      (state.scope === "all" ||
        (state.scope === "in" ? libraryIds.has(game.id) : !libraryIds.has(game.id)))
  );
  if (state.sort === "catalog")
    return query
      ? filtered.sort((a, b) => titleMatch(a.name, query)! - titleMatch(b.name, query)!)
      : filtered;
  return filtered.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name) || a.id - b.id;
    const left = releaseTime(a),
      right = releaseTime(b);
    if (left === undefined) return right === undefined ? a.name.localeCompare(b.name) : 1;
    if (right === undefined) return -1;
    return (
      (state.sort === "oldest" ? left - right : right - left) ||
      a.name.localeCompare(b.name) ||
      a.id - b.id
    );
  });
}
function releaseTime(game: RelatedGameSlim) {
  const value = game.first_release_date;
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return undefined;
  const date = new Date(value * 1000),
    year = date.getUTCFullYear();
  return Number.isFinite(date.getTime()) && year >= 1900 && year <= 2100 ? value : undefined;
}
export function relatedYear(game: RelatedGameSlim) {
  const value = releaseTime(game);
  return value === undefined
    ? "Release date not listed"
    : String(new Date(value * 1000).getUTCFullYear());
}
export function readRelatedPosition(
  raw: string | null,
  key: string
): { top: number; limit: number } {
  try {
    const value = JSON.parse(raw ?? "{}")?.[key];
    return {
      top:
        typeof value?.top === "number" && Number.isFinite(value.top) && value.top >= 0
          ? value.top
          : 0,
      limit:
        Number.isInteger(value?.limit) && value.limit >= 48 && value.limit <= 10000
          ? value.limit
          : 48,
    };
  } catch {
    return { top: 0, limit: 48 };
  }
}
export function writeRelatedPosition(
  raw: string | null,
  key: string,
  top: number,
  limit: number
): string {
  let entries: Record<string, unknown> = {};
  try {
    const value = JSON.parse(raw ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) entries = value;
  } catch {
    /* Use an empty browsing record. */
  }
  delete entries[key];
  entries[key] = {
    top: Math.max(0, Number.isFinite(top) ? top : 0),
    limit: Math.max(48, Math.min(10000, limit)),
  };
  return JSON.stringify(Object.fromEntries(Object.entries(entries).slice(-12)));
}
