import type { ICatalogSource, CatalogGame } from "./types";
import type { IgdbSearchResult } from "../types";
export function igdbCoverUrl(imageId: string, size = "cover_big"): string {
  return "https://images.igdb.com/igdb/image/upload/t_" + size + "/" + imageId + ".jpg";
}
const searchCache = new Map<string, CatalogGame[]>();
const fetchCache = new Map<number, CatalogGame>();
async function request(url: string): Promise<CatalogGame[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Catalog request timed out")), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok)
      throw new Error(
        "Catalog unavailable (" +
          response.status +
          "). Check your connection and IGDB configuration."
      );
    const raw = (await response.json()) as IgdbSearchResult[];
    return raw.map(normalise);
  } finally {
    clearTimeout(timeout);
  }
}
class RealIgdbCatalog implements ICatalogSource {
  async search(query: string): Promise<CatalogGame[]> {
    const key = query.trim().toLowerCase();
    if (!key) return [];
    if (searchCache.has(key)) return searchCache.get(key)!;
    const games = await request("/api/igdb/search?q=" + encodeURIComponent(query));
    searchCache.set(key, games);
    return games;
  }
  async searchAll(query: string, limit = 50, offset = 0): Promise<CatalogGame[]> {
    if (!query.trim()) return [];
    return request(
      "/api/igdb/search?" +
        new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) })
    );
  }
  async fetch(igdbId: number): Promise<CatalogGame | null> {
    if (fetchCache.has(igdbId)) return fetchCache.get(igdbId)!;
    const games = await request("/api/igdb/fetch?id=" + igdbId);
    const game = games[0] ?? null;
    if (game) fetchCache.set(igdbId, game);
    return game;
  }
}
function normalise(raw: IgdbSearchResult): CatalogGame {
  return {
    igdbId: raw.id,
    title: raw.name,
    slug: raw.slug,
    developer: raw.involved_companies?.find((ic) => ic.developer)?.company?.name ?? "Unknown",
    publisher: raw.involved_companies?.find((ic) => ic.publisher)?.company?.name,
    releaseYear: raw.first_release_date ? new Date(raw.first_release_date * 1000).getFullYear() : 0,
    firstReleaseDate: raw.first_release_date,
    summary: raw.summary,
    genres: raw.genres?.map((g) => g.name) ?? [],
    platforms: raw.platforms?.map((p) => p.name) ?? [],
    coverUrl: raw.cover ? igdbCoverUrl(raw.cover.image_id) : undefined,
    igdbRating: raw.rating === undefined ? undefined : Math.round(raw.rating),
  };
}
export const catalog: ICatalogSource = new RealIgdbCatalog();
