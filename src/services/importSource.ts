import type { CatalogGame } from "../catalog";

export interface ImportedGame {
  sourceId: string;
  sourceName: string;
  timePlayedHours?: number;
  lastPlayedAt?: number;
}

export interface MatchedImportGame {
  imported: ImportedGame;
  igdbGame: CatalogGame | null;
  confidence: "high" | "low" | "none";
  matchError?: string;
}

export interface IImportSource {
  id: string;
  name: string;
  fetchLibrary(userId: string): Promise<ImportedGame[]>;
  matchGames(
    games: ImportedGame[],
    onProgress?: (pct: number, msg: string) => void
  ): Promise<MatchedImportGame[]>;
}
