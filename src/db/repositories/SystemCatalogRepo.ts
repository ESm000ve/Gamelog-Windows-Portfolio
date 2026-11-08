import { db } from "../schema";
import { captureLibrarySnapshot } from "../recoverySnapshot";
import type { CatalogGame } from "../../catalog";
import type { Log, Status } from "../../types";
export const SystemCatalogRepo = {
  async save(game: CatalogGame, platform: string, change: Partial<Pick<Log, "status" | "rating">>) {
    return db.transaction("rw", [db.games, db.logs, db.lists, db.tags, db.removals], async () => {
      const existing = await db.games.get(game.igdbId),
        log = await db.logs.get(game.igdbId);
      const recoveryId = !existing
        ? await captureLibrarySnapshot("Library before system game addition")
        : undefined;
      const now = Date.now();
      if (!existing) await db.games.add({ ...game, addedAt: now, updatedAt: now });
      else await db.games.update(game.igdbId, { updatedAt: now });
      await db.logs.put(
        log
          ? { ...log, ...change, updatedAt: now }
          : {
              igdbId: game.igdbId,
              status: "Backlog",
              platform,
              ...change,
              createdAt: now,
              updatedAt: now,
            }
      );
      return recoveryId;
    });
  },
  async addSelected(games: CatalogGame[], platform: string, status: Status) {
    return db.transaction("rw", [db.games, db.logs, db.lists, db.tags, db.removals], async () => {
      const unique = [...new Map(games.map((game) => [game.igdbId, game])).values()];
      const fresh: CatalogGame[] = [];
      for (const game of unique) if (!(await db.games.get(game.igdbId))) fresh.push(game);
      if (!fresh.length) return { count: 0, recoveryId: undefined };
      const recoveryId = await captureLibrarySnapshot("Library before system game additions");
      const now = Date.now();
      for (const game of fresh) {
        await db.games.add({ ...game, addedAt: now, updatedAt: now });
        if (!(await db.logs.get(game.igdbId)))
          await db.logs.add({
            igdbId: game.igdbId,
            status,
            platform,
            createdAt: now,
            updatedAt: now,
          });
      }
      return { count: fresh.length, recoveryId };
    });
  },
};
