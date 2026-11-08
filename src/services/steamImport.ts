import type { IImportSource, ImportedGame, MatchedImportGame } from "./importSource";
import type { CatalogGame } from "../catalog";
import { catalog } from "../catalog";

export const steamImportSource: IImportSource = {
  id: "steam",
  name: "Steam",
  async fetchLibrary(steamId: string): Promise<ImportedGame[]> {
    const res = await fetch(`/api/steam/owned-games?steamId=${encodeURIComponent(steamId)}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fetch Steam library");
    }
    const data = await res.json();
    return (data.games || []).map((g: any) => ({
      sourceId: g.appid.toString(),
      sourceName: g.name,
      timePlayedHours: g.playtime_forever ? Math.round(g.playtime_forever / 60) : undefined,
      lastPlayedAt: g.rtime_last_played ? g.rtime_last_played * 1000 : undefined,
    }));
  },

  async matchGames(
    games: ImportedGame[],
    onProgress?: (pct: number, msg: string) => void
  ): Promise<MatchedImportGame[]> {
    const appIds = games.map((g) => g.sourceId);

    if (onProgress) onProgress(10, "Matching games against IGDB database...");

    const res = await fetch("/api/igdb/match-steam", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appIds }),
    });

    let exactMatches: Record<string, CatalogGame> = {};
    if (res.ok) {
      exactMatches = await res.json();
    } else {
      console.warn("Failed to batch match Steam games via IGDB external_games");
    }

    const results: MatchedImportGame[] = [];
    const unmatched = games.filter((g) => !exactMatches[g.sourceId]);

    // Fuzzy matching for unmatched games
    const fuzzyMatches = new Map<string, CatalogGame | null>();
    const failedMatches = new Set<string>();

    let processed = 0;
    const chunkedUnmatched = [];
    for (let i = 0; i < unmatched.length; i += 5) {
      chunkedUnmatched.push(unmatched.slice(i, i + 5));
    }

    for (const chunk of chunkedUnmatched) {
      await Promise.all(
        chunk.map(async (g) => {
          try {
            // Add year to search if possible? Steam doesn't provide release year in GetOwnedGames
            const searchRes = await catalog.search(g.sourceName);
            if (searchRes.length > 0) {
              fuzzyMatches.set(g.sourceId, searchRes[0]);
            } else {
              fuzzyMatches.set(g.sourceId, null);
            }
          } catch (err) {
            console.warn("Failed to search steam game on IGDB", err);
            failedMatches.add(g.sourceId);
            fuzzyMatches.set(g.sourceId, null);
          }
        })
      );
      processed += chunk.length;
      if (onProgress) {
        const pct = 10 + Math.round((processed / Math.max(unmatched.length, 1)) * 90);
        onProgress(pct, `Fuzzy matching remaining games... (${processed}/${unmatched.length})`);
      }
    }

    for (const g of games) {
      if (exactMatches[g.sourceId]) {
        results.push({
          imported: g,
          igdbGame: exactMatches[g.sourceId],
          confidence: "high",
        });
      } else {
        const fuzzy = fuzzyMatches.get(g.sourceId);
        results.push({
          imported: g,
          igdbGame: fuzzy || null,
          confidence: fuzzy ? "low" : "none",
          matchError: failedMatches.has(g.sourceId)
            ? "Catalog unavailable — retry the import"
            : undefined,
        });
      }
    }

    if (onProgress) onProgress(100, "Matching complete");
    return results;
  },
};
