import type { ResumeRecap } from "./recap.ts";
// ─── Status taxonomy ──────────────────────────────────────────────────────────

export type Status = "Wishlist" | "Backlog" | "Playing" | "Played";

export type Completion = "Completed" | "Mastered" | "Abandoned" | "Shelved";

export type Ownership = "Physical" | "Digital" | "Subscription" | "Borrowed";

// ─── Related games ────────────────────────────────────────────────────────────

export type RelatedTab = "Related" | "Ports" | "Series" | "Mods" | "In bundles";

export interface RelatedGame {
  igdbId: number;
  title: string;
  developer?: string;
  releaseYear?: number;
  coverUrl?: string;
  coverColor?: string;
  /** Populated when the game is also in the user's library */
  status?: Status;
  rating?: number;
}

export interface RelatedGames {
  related?: RelatedGame[];
  ports?: RelatedGame[];
  series?: RelatedGame[];
  mods?: RelatedGame[];
  bundles?: RelatedGame[];
}

// ─── Time to beat (from IGDB) ─────────────────────────────────────────────────

export interface TimeToBeat {
  /** Hastily / quick run (hours) */
  average?: number;
  /** Normally / main story (hours) */
  finish?: number;
  /** Completely / 100% (hours) */
  master?: number;
}

// ─── Game (catalog data, populated from IGDB) ────────────────────────────────

export interface Game {
  /** IGDB game ID — primary key */
  igdbId: number;
  title: string;
  slug: string;
  developer: string;
  publisher?: string;
  releaseYear: number;
  /** Unix timestamp for exact release date tie-breaking */
  firstReleaseDate?: number;
  summary?: string;
  genres: string[];
  platforms: string[];
  /** Full IGDB cover URL (https://images.igdb.com/…) */
  coverUrl?: string;
  /** Extracted dominant color used as fallback */
  coverColor?: string;
  timeToBeat?: TimeToBeat;
  /** IGDB community rating 0–100 */
  igdbRating?: number;
  /** Semantic embedding vector for "Games like this" */
  embedding?: number[];
  /** Model provenance: vectors from different models must never be compared. */
  embeddingModel?: string;
  /** Deal price fetched from external tracker */
  dealPrice?: number;
  /** Link to the deal */
  dealUrl?: string;
  addedAt: number;
  updatedAt: number;
}

// ─── Log (personal play record — one per Game in library) ───────────────────

export interface Log {
  /** FK → Game.igdbId */
  igdbId: number;
  status: Status;
  /** Sub-state — only meaningful when status = "Played" */
  completion?: Completion;
  /** 0.5–5.0 in 0.5 increments, undefined = not yet rated */
  rating?: number;
  platform?: string;
  platforms?: string[];
  /** Hours played (numeric) */
  timePlayed?: number;
  /** ISO date string "YYYY-MM-DD" */
  startedAt?: string;
  finishedAt?: string;
  ownership?: Ownership[];
  notes?: string;
  /** Optional reviewed recap, separate from the original notes. */
  resumeRecap?: ResumeRecap;
  tagIds?: string[];
  /** 0 to 100 representing completion */
  completionPercentage?: number;
  /** History of play sessions for streak tracking */
  playSessions?: { date: string; durationMinutes?: number }[];
  createdAt: number;
  updatedAt: number;
}

// ─── UserList ─────────────────────────────────────────────────────────────────

export interface UserList {
  /** UUID */
  id: string;
  name: string;
  isRanked: boolean;
  /** Ordered array of igdbIds; order = rank when isRanked */
  gameIds: number[];
  createdAt: number;
  updatedAt: number;
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string; // uuid
  name: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Derived / view models ────────────────────────────────────────────────────

/** A Game joined with its Log — the primary view model for library screens */
export interface LibraryEntry {
  game: Game;
  log: Log;
}

/** Stats derived from the Log + Game tables */
export interface DerivedStats {
  totalGames: number;
  hoursPlayed: number;
  avgRating: number | null;
  playedThisYear: number;
  ratingDist: { label: string; value: number }[];
  byPlatform: { label: string; value: number }[];
  byGenre: { label: string; value: number }[];
  byStatus: { label: string; value: number; color: string }[];
}

// ─── IGDB search result (raw, before normalisation) ──────────────────────────

export interface IgdbSearchResult {
  id: number;
  name: string;
  slug: string;
  first_release_date?: number;
  summary?: string;
  genres?: { name: string }[];
  platforms?: { name: string }[];
  involved_companies?: {
    company: { name: string };
    developer: boolean;
    publisher: boolean;
  }[];
  cover?: { image_id: string };
  rating?: number;
  game_localizations?: unknown[];
}
