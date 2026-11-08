import { RecoveryRepo } from "./RecoveryRepo";
import { db } from "../schema";
import { catalog } from "../../catalog";
import type { Game } from "../../types";
import { parseBackup, isFullGame, type BackupData } from "../../services/backupFormat";
export type { BackupData } from "../../services/backupFormat";
export const BackupRepo = {
  async exportBackup(): Promise<string> {
    return db.transaction("r", [db.games, db.logs, db.lists, db.tags], async () => {
      const [games, logs, lists, tags] = await Promise.all([
        db.games.toArray(),
        db.logs.toArray(),
        db.lists.toArray(),
        db.tags.toArray(),
      ]);
      const data: BackupData = {
        version: 2,
        exported: new Date().toISOString(),
        games,
        logs,
        lists,
        tags,
      };
      return JSON.stringify(data, null, 2);
    });
  },
  async importBackup(
    json: string,
    mode: "merge" | "replace" = "replace",
    onProgress = (_pct: number, _message: string) => {}
  ): Promise<string> {
    const data = parseBackup(json);
    const games: Game[] = [];
    for (const [index, game] of data.games.entries()) {
      onProgress(Math.round((index / data.games.length) * 90), "Preparing games...");
      if (isFullGame(game)) games.push(game);
      else {
        const metadata = await catalog.fetch(game.igdbId);
        if (!metadata)
          throw new Error(
            "Cannot restore game " + game.igdbId + ". Your existing data has not been changed."
          );
        games.push({ ...metadata, addedAt: game.addedAt, updatedAt: game.updatedAt });
      }
    }
    onProgress(95, "Writing to database...");
    const recoveryId = await db.transaction(
      "rw",
      [db.games, db.logs, db.lists, db.tags, db.removals],
      async () => {
        const recoveryId = await RecoveryRepo.captureLibrary("Library before backup import");
        if (mode === "replace") {
          await Promise.all([db.games.clear(), db.logs.clear(), db.lists.clear()]);
          // Old backups omitted tags. Preserve definitions already on this device.
          if (data.tags) await db.tags.clear();
        }
        await db.games.bulkPut(games);
        await db.logs.bulkPut(data.logs);
        await db.lists.bulkPut(data.lists);
        if (data.tags) await db.tags.bulkPut(data.tags);
        return recoveryId;
      }
    );
    onProgress(100, "Import completed");
    return recoveryId;
  },
};
