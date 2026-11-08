import { LogsRepo, type LogUpdate } from "./LogsRepo";
import { captureLibrarySnapshot } from "../recoverySnapshot";
import { db } from "../schema";
import type { Game, Log, Status } from "../../types";
import type { CatalogGame } from "../../catalog";

export const GamesRepo = {
  /** Commit a reviewed log and any new library entry together, only on Save. */
  async saveReviewedLog(game: CatalogGame, update: LogUpdate): Promise<void> {
    await db.transaction("rw", [db.games, db.logs], async () => {
      await GamesRepo.addFromCatalog(game, update.status);
      await LogsRepo.save(game.igdbId, update);
    });
  },
  /**
   * Adds a game from the catalog into the local library, creating its initial log.
   * Executed in a single transaction.
   */
  async addFromCatalog(catalogGame: CatalogGame, initialStatus: Status = "Backlog"): Promise<void> {
    const now = Date.now();
    const game: Game = {
      ...catalogGame,
      addedAt: now,
      updatedAt: now,
    };
    const log: Log = {
      igdbId: game.igdbId,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    };
    await db.transaction("rw", [db.games, db.logs], async () => {
      const existing = await db.games.get(game.igdbId);
      if (!existing) await db.games.add(game);
      if (!(await db.logs.get(game.igdbId))) await db.logs.add(log);
      return !existing;
    });
  },

  /**
   * Idempotently bulk imports games and logs.
   * If a log exists, its status is preserved.
   * Playtime is merged based on `overwritePlaytime`.
   */
  async bulkImport(
    gamesToImport: Game[],
    logsToImport: Log[],
    overwritePlaytime: boolean
  ): Promise<string | undefined> {
    if (!gamesToImport.length && !logsToImport.length) return undefined;
    return db.transaction("rw", [db.games, db.logs, db.lists, db.tags, db.removals], async () => {
      const recoveryId = await captureLibrarySnapshot("Library before game import");
      // 1. Process games
      for (const game of gamesToImport) {
        const existingGame = await db.games.get(game.igdbId);
        if (!existingGame) {
          await db.games.put(game);
        } else {
          // Keep existing addedAt, update the rest
          await db.games.put({
            ...existingGame,
            ...game,
            addedAt: existingGame.addedAt,
            embedding: game.embedding ?? existingGame.embedding,
            embeddingModel: game.embedding ? game.embeddingModel : existingGame.embeddingModel,
            timeToBeat: game.timeToBeat ?? existingGame.timeToBeat,
          });
        }
      }

      // 2. Process logs
      for (const log of logsToImport) {
        const existingLog = await db.logs.get(log.igdbId);
        if (!existingLog) {
          await db.logs.put(log);
        } else {
          const updatedLog = { ...existingLog, updatedAt: Date.now() };
          // Merge playtime
          if (log.timePlayed !== undefined && log.timePlayed > 0) {
            if (
              overwritePlaytime ||
              existingLog.timePlayed === undefined ||
              existingLog.timePlayed === 0
            ) {
              updatedLog.timePlayed = log.timePlayed;
            }
          }
          await db.logs.put(updatedLog);
        }
      }
      return recoveryId;
    });
  },

  /** Removes a game and its log from the local library, and cleans it from any lists. */
  async remove(igdbId: number): Promise<void> {
    await db.transaction("rw", [db.games, db.logs, db.lists], async () => {
      await db.games.delete(igdbId);
      await db.logs.delete(igdbId);

      const listsWithGame = await db.lists.filter((l) => l.gameIds.includes(igdbId)).toArray();
      if (listsWithGame.length > 0) {
        for (const list of listsWithGame) {
          list.gameIds = list.gameIds.filter((id) => id !== igdbId);
          list.updatedAt = Date.now();
          await db.lists.put(list);
        }
      }
    });
  },

  /** Retrieves a single game by ID. */
  async get(igdbId: number): Promise<Game | undefined> {
    return db.games.get(igdbId);
  },

  async getAll(): Promise<Game[]> {
    return db.games.toArray();
  },

  async backfillReleaseDates(): Promise<void> {
    const missing = await db.games.filter((g) => !g.firstReleaseDate).toArray();
    if (missing.length === 0) return;

    for (let i = 0; i < missing.length; i += 100) {
      const chunk = missing.slice(i, i + 100);
      const ids = chunk.map((g) => g.igdbId).join(",");
      try {
        const res = await fetch(`/api/igdb/bulk-fetch?ids=${ids}`);
        if (!res.ok) continue;
        const data = await res.json();

        for (const igdbGame of data) {
          if (igdbGame.first_release_date) {
            await db.games.update(igdbGame.id, { firstReleaseDate: igdbGame.first_release_date });
          }
        }
      } catch (err) {
        console.warn("Failed to backfill release dates:", err);
      }
    }
  },
};
