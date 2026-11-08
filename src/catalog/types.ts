import type { TimeToBeat } from "../types";

// ─── CatalogGame — what any catalog source returns ────────────────────────────

/**
 * Normalized game metadata as returned by a catalog source (e.g. IGDB).
 * This is the transient shape that lives between the API and Dexie.
 * `db/operations.ts::addGameToLibrary` converts it to a stored `Game`.
 */
export interface CatalogGame {
  /** Stable integer ID (IGDB game ID). Primary key. */
  igdbId: number;
  title: string;
  slug: string;
  developer: string;
  publisher?: string;
  releaseYear: number;
  firstReleaseDate?: number;
  summary?: string;
  genres: string[];
  platforms: string[];
  /** Full HTTPS cover art URL (images.igdb.com). */
  coverUrl?: string;
  timeToBeat?: TimeToBeat;
  /** IGDB community score 0–100. */
  igdbRating?: number;
}

// ─── ICatalogSource — the swappable catalog interface ─────────────────────────

/**
 * Any catalog backend (IGDB, local stub, future alternative) must implement
 * this interface. The UI always codes against ICatalogSource, never against a
 * concrete class — so swapping the backend requires editing one line in
 * `catalog/index.ts`.
 */
export interface ICatalogSource {
  /**
   * Search games by title. Returns up to 10 results.
   * Must never throw — return [] on error.
   */
  search(query: string): Promise<CatalogGame[]>;

  /**
   * Paginated search for full results.
   */
  searchAll(query: string, limit?: number, offset?: number): Promise<CatalogGame[]>;

  /**
   * Fetch full metadata for a specific game by its catalog ID.
   * Returns null if not found.
   */
  fetch(igdbId: number): Promise<CatalogGame | null>;
}
