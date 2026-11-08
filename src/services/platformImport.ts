import { captureLibrarySnapshot } from "../db/recoverySnapshot";
import { catalog } from "../catalog";
import type { ImportedGame, MatchedImportGame } from "./importSource";
import { db } from "../db/schema";
import type { Status } from "../types";

export type PlatformType = "PSN" | "Xbox" | "GOG";

export function parsePlatformList(content: string, platform: PlatformType): ImportedGame[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const results: ImportedGame[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if it's a CSV header or empty line
    if (
      i === 0 &&
      /^(title|game|game title|name)$/i.test(line.split(/[,\t]/)[0].trim().replace(/^"|"$/g, ""))
    ) {
      continue;
    }

    // Try splitting by comma or tab if multiple fields exist
    const parts: string[] = [];
    let field = "";
    let quoted = false;
    for (let cursor = 0; cursor < line.length; cursor++) {
      const char = line[cursor];
      if (char === '"') {
        if (quoted && line[cursor + 1] === '"') {
          field += '"';
          cursor++;
        } else quoted = !quoted;
      } else if ((char === "," || char === "\t") && !quoted) {
        parts.push(field.trim());
        field = "";
      } else field += char;
    }
    parts.push(field.trim());
    const title = parts[0];
    if (!title || title.length < 2) continue;

    let timePlayedHours = 0;
    // Check if any part looks like hours or playtime (e.g. "45h" or "45")
    for (let j = 1; j < parts.length; j++) {
      const p = parts[j];
      const match = p.match(/^(\d+(?:\.\d+)?)\s*(?:h|hrs|hours)?$/i);
      if (match) {
        timePlayedHours = parseFloat(match[1]);
        break;
      }
    }

    results.push({
      sourceId: `${platform.toLowerCase()}-${i}-${title.toLowerCase().replace(/\s+/g, "-")}`,
      sourceName: title,
      timePlayedHours: timePlayedHours > 0 ? timePlayedHours : undefined,
    });
  }

  return results;
}

export async function matchPlatformGames(
  games: ImportedGame[],
  onProgress?: (pct: number, msg: string) => void
): Promise<MatchedImportGame[]> {
  const results: MatchedImportGame[] = [];
  let processed = 0;

  const chunked = [];
  for (let i = 0; i < games.length; i += 5) {
    chunked.push(games.slice(i, i + 5));
  }

  for (const chunk of chunked) {
    await Promise.all(
      chunk.map(async (g) => {
        try {
          const searchRes = await catalog.search(g.sourceName);
          if (searchRes.length > 0) {
            results.push({
              imported: g,
              igdbGame: searchRes[0],
              confidence:
                searchRes[0].title.toLowerCase() === g.sourceName.toLowerCase() ? "high" : "low",
            });
          } else {
            results.push({
              imported: g,
              igdbGame: null,
              confidence: "none",
            });
          }
        } catch (err) {
          console.error("Failed to fetch IGDB data for imported title", err);
          results.push({
            imported: g,
            igdbGame: null,
            confidence: "none",
            matchError: "Catalog unavailable — try matching again",
          });
        }
      })
    );

    processed += chunk.length;
    if (onProgress) {
      const pct = Math.round((processed / Math.max(games.length, 1)) * 100);
      onProgress(pct, `Matching against catalog... (${processed}/${games.length})`);
    }
  }

  return results;
}

export async function importMatchedPlatformGames(
  matches: MatchedImportGame[],
  defaultStatus: Status,
  overwritePlaytime: boolean,
  platform: PlatformType
): Promise<{ count: number; recoveryId: string }> {
  let count = 0;

  const recoveryId = await db.transaction(
    "rw",
    [db.games, db.logs, db.lists, db.tags, db.removals],
    async () => {
      const recoveryId = await captureLibrarySnapshot("Library before platform import");
      for (const match of matches) {
        if (!match.igdbGame) continue;
        const { igdbGame, imported } = match;

        const now = Date.now();
        const existingGame = await db.games.get(igdbGame.igdbId);
        if (!existingGame) {
          await db.games.put({
            igdbId: igdbGame.igdbId,
            title: igdbGame.title,
            slug: igdbGame.slug,
            coverUrl: igdbGame.coverUrl,
            releaseYear: igdbGame.releaseYear,
            genres: igdbGame.genres,
            platforms: igdbGame.platforms,
            developer: igdbGame.developer,
            addedAt: now,
            updatedAt: now,
          });
        }

        const existingLog = await db.logs.get(igdbGame.igdbId);
        const platformName =
          platform === "PSN" ? "PlayStation" : platform === "Xbox" ? "Xbox" : "PC (GOG)";

        if (existingLog) {
          const updates: any = { updatedAt: now };
          if (!existingLog.platform) updates.platform = platformName;
          if (
            imported.timePlayedHours !== undefined &&
            (overwritePlaytime || !existingLog.timePlayed)
          ) {
            updates.timePlayed = imported.timePlayedHours;
          }
          await db.logs.update(igdbGame.igdbId, updates);
        } else {
          await db.logs.put({
            igdbId: igdbGame.igdbId,
            status: defaultStatus,
            timePlayed: imported.timePlayedHours || 0,
            platform: platformName,
            createdAt: now,
            updatedAt: now,
          });
        }

        count++;
      }
      return recoveryId;
    }
  );

  return { count, recoveryId };
}
