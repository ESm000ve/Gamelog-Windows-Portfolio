export type SystemGameType =
  "playable" | "all" | "games" | "versions" | "addons" | "bundles" | "other" | "unknown";
export const SYSTEM_GAME_TYPES: { value: SystemGameType; label: string }[] = [
  { value: "playable", label: "Games and editions" },
  { value: "all", label: "All types" },
  { value: "games", label: "Full games & standalone expansions" },
  { value: "versions", label: "Remakes, remasters & ports" },
  { value: "addons", label: "DLC & expansions" },
  { value: "bundles", label: "Bundles" },
  { value: "other", label: "Other types" },
  { value: "unknown", label: "Not classified" },
];
export interface SystemCatalogGame {
  igdbId: number;
  title: string;
  slug?: string;
  releaseYear?: number;
  firstReleaseDate?: number;
  coverUrl?: string;
  rating?: number;
  genres?: string[];
  category?: number;
}
export interface SystemCatalogFilters {
  sort: string;
  includeAll: boolean;
  genre: string;
  startYear: string;
  endYear: string;
  minRating: string;
  q: string;
  type?: SystemGameType;
  library?: "all" | "in" | "new";
}
export function systemFilterError(filters: SystemCatalogFilters): string | null {
  for (const value of [filters.startYear, filters.endYear])
    if (value && (!/^\d{4}$/.test(value) || Number(value) < 1900 || Number(value) > 2100))
      return "Enter a release year from 1900 to 2100.";
  if (filters.startYear && filters.endYear && Number(filters.startYear) > Number(filters.endYear))
    return "The start year must be before or equal to the end year.";
  if (filters.minRating && (!/^\d+$/.test(filters.minRating) || Number(filters.minRating) > 100))
    return "Enter a community score from 0 to 100.";
  return null;
}
export function parseSystemCatalog(data: unknown): {
  games: SystemCatalogGame[];
  hasMore: boolean;
} {
  if (!data || typeof data !== "object" || !Array.isArray((data as { games?: unknown }).games))
    throw new Error("The game catalog returned an invalid response. Please try again.");
  const value = data as { games: unknown[]; hasMore?: unknown };
  const games = value.games.map((raw) => {
    if (!raw || typeof raw !== "object")
      throw new Error("The game catalog returned an invalid game.");
    const game = raw as SystemCatalogGame;
    if (
      !Number.isSafeInteger(game.igdbId) ||
      game.igdbId <= 0 ||
      typeof game.title !== "string" ||
      !game.title.trim()
    )
      throw new Error("The game catalog returned an invalid game.");
    return game;
  });
  return {
    games: [...new Map(games.map((game) => [game.igdbId, game])).values()],
    hasMore: value.hasMore === true && games.length > 0,
  };
}

export const DEFAULT_SYSTEM_FILTERS: SystemCatalogFilters = {
  sort: "popularity",
  includeAll: false,
  genre: "",
  startYear: "",
  endYear: "",
  minRating: "",
  q: "",
  type: "playable",
  library: "all",
};
export function readSystemCatalogState(raw: string | null): {
  filters: SystemCatalogFilters;
  view: "grid" | "list";
} {
  try {
    const data = JSON.parse(raw ?? "{}"),
      value = data?.filters;
    const filters = { ...DEFAULT_SYSTEM_FILTERS };
    if (value && typeof value === "object") {
      if (["popularity", "release_desc", "release_asc", "name", "rating"].includes(value.sort))
        filters.sort = value.sort;
      if (SYSTEM_GAME_TYPES.some((type) => type.value === value.type)) filters.type = value.type;
      if (["all", "in", "new"].includes(value.library)) filters.library = value.library;
      for (const key of ["q", "genre", "startYear", "endYear", "minRating"] as const)
        if (typeof value[key] === "string") filters[key] = value[key].slice(0, 120);
      if (systemFilterError(filters))
        return { filters: { ...DEFAULT_SYSTEM_FILTERS }, view: "grid" };
    }
    return { filters, view: data?.view === "list" ? "list" : "grid" };
  } catch {
    return { filters: { ...DEFAULT_SYSTEM_FILTERS }, view: "grid" };
  }
}
