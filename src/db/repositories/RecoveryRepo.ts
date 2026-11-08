import { captureLibrarySnapshot as captureLibrary } from "../recoverySnapshot";
import { db } from "../schema";
import { GamesRepo } from "./GamesRepo";
import { ListsRepo } from "./ListsRepo";
import type { RecoveryEntry, ListMembership } from "../../types/recovery";
import type { UserList, Tag } from "../../types";
const tables = () => [db.games, db.logs, db.lists, db.tags, db.removals];
const base = (label: string) => ({ id: crypto.randomUUID(), label, removedAt: Date.now() });
function membership(list: UserList, gameId: number): ListMembership {
  const index = list.gameIds.indexOf(gameId);
  return {
    listId: list.id,
    index,
    before: list.gameIds[index - 1],
    after: list.gameIds[index + 1],
  };
}
function insertMembership(ids: number[], gameId: number, position: ListMembership) {
  if (ids.includes(gameId)) return ids;
  const result = [...ids];
  const after = position.after === undefined ? -1 : result.indexOf(position.after);
  const before = position.before === undefined ? -1 : result.indexOf(position.before);
  const index =
    after >= 0
      ? after
      : before >= 0
        ? before + 1
        : Math.min(Math.max(position.index, 0), result.length);
  result.splice(index, 0, gameId);
  return result;
}
async function restoreMembership(gameId: number, position: ListMembership) {
  const list = await db.lists.get(position.listId);
  if (list) {
    if (!list.gameIds.includes(gameId))
      await db.lists.update(list.id, {
        gameIds: insertMembership(list.gameIds, gameId, position),
        updatedAt: Date.now(),
      });
    return;
  }
  // A game can be restored before its removed list. Preserve its place in that saved list.
  const removedLists = await db.removals.where("kind").equals("list").toArray();
  for (const saved of removedLists)
    if (saved.kind === "list" && saved.list.id === position.listId)
      await db.removals.put({
        ...saved,
        list: { ...saved.list, gameIds: insertMembership(saved.list.gameIds, gameId, position) },
      });
}
export const RecoveryRepo = {
  async forget(id: string) {
    await db.removals.delete(id);
  },
  async captureLibrary(label: string) {
    return db.transaction("rw", tables(), () => captureLibrary(label));
  },
  async removeGame(gameId: number) {
    return db.transaction("rw", tables(), async () => {
      const game = await db.games.get(gameId);
      if (!game) return undefined;
      const log = await db.logs.get(gameId);
      const lists = await db.lists.filter((list) => list.gameIds.includes(gameId)).toArray();
      const tags = (await db.tags.bulkGet(log?.tagIds ?? [])).filter((tag): tag is Tag =>
        Boolean(tag)
      );
      const entry: RecoveryEntry = {
        ...base(game.title),
        kind: "game",
        game,
        log,
        tags,
        memberships: lists.map((list) => membership(list, gameId)),
      };
      await db.removals.add(entry);
      await GamesRepo.remove(gameId);
      return entry.id;
    });
  },
  async removeList(id: string) {
    return db.transaction("rw", tables(), async () => {
      const list = await db.lists.get(id);
      if (!list) return undefined;
      const entry: RecoveryEntry = { ...base(list.name), kind: "list", list };
      await db.removals.add(entry);
      await ListsRepo.delete(id);
      return entry.id;
    });
  },
  async removeListGame(listId: string, gameId: number) {
    return db.transaction("rw", tables(), async () => {
      const list = await db.lists.get(listId);
      if (!list || !list.gameIds.includes(gameId)) return undefined;
      const game = await db.games.get(gameId);
      const entry: RecoveryEntry = {
        ...base(game?.title ?? "Game"),
        kind: "list-item",
        gameId,
        listName: list.name,
        membership: membership(list, gameId),
      };
      await db.removals.add(entry);
      await ListsRepo.removeGame(listId, gameId);
      return entry.id;
    });
  },
  async restore(id: string) {
    return db.transaction("rw", tables(), async () => {
      const entry = await db.removals.get(id);
      if (!entry) return;
      if (entry.kind === "game") {
        if ((await db.games.get(entry.game.igdbId)) || (await db.logs.get(entry.game.igdbId)))
          throw new Error(
            "This game already has a current entry. Your current notes were kept, and the removed copy remains available here."
          );
        await db.games.add({ ...entry.game, updatedAt: Date.now() });
        if (entry.log) await db.logs.add({ ...entry.log, updatedAt: Date.now() });
        for (const tag of entry.tags) if (!(await db.tags.get(tag.id))) await db.tags.add(tag);
        for (const position of entry.memberships)
          await restoreMembership(entry.game.igdbId, position);
      } else if (entry.kind === "list") {
        if (await db.lists.get(entry.list.id))
          throw new Error("A list with this identity already exists. Your current list was kept.");
        const games = await db.games.bulkGet(entry.list.gameIds);
        const present = new Set(games.filter(Boolean).map((game) => game!.igdbId));
        // Carry missing memberships into removed game records, so restoration order cannot lose them.
        const removed = await db.removals.where("kind").equals("game").toArray();
        for (const saved of removed) {
          if (
            saved.kind !== "game" ||
            present.has(saved.game.igdbId) ||
            !entry.list.gameIds.includes(saved.game.igdbId)
          )
            continue;
          if (!saved.memberships.some((position) => position.listId === entry.list.id))
            await db.removals.put({
              ...saved,
              memberships: [...saved.memberships, membership(entry.list, saved.game.igdbId)],
            });
        }
        await db.lists.add({
          ...entry.list,
          gameIds: entry.list.gameIds.filter((gameId) => present.has(gameId)),
          updatedAt: Date.now(),
        });
      } else if (entry.kind === "list-item") {
        if (!(await db.lists.get(entry.membership.listId)))
          throw new Error("Restore the removed list first, then restore this game to it.");
        if (!(await db.games.get(entry.gameId)))
          throw new Error(
            "Restore this game to your library first, then restore its list position."
          );
        await restoreMembership(entry.gameId, entry.membership);
      } else if (entry.kind === "sessions") {
        const log = await db.logs.get(entry.gameId);
        if (!(await db.games.get(entry.gameId)) || !log || log.createdAt !== entry.logCreatedAt)
          throw new Error(
            "Restore the original game and log before restoring its session history."
          );
        if (JSON.stringify(log.playSessions ?? []) !== JSON.stringify(entry.after))
          throw new Error(
            "Session history has newer changes. Those changes were kept; this recovery copy remains available."
          );
        await db.logs.update(entry.gameId, { playSessions: entry.before, updatedAt: Date.now() });
      } else {
        // The current library is retained as another recovery point, including any newer edits.
        await captureLibrary("Library before recovery");
        await Promise.all([db.games.clear(), db.logs.clear(), db.lists.clear(), db.tags.clear()]);
        await db.games.bulkPut(entry.games);
        await db.logs.bulkPut(entry.logs);
        await db.lists.bulkPut(entry.lists);
        await db.tags.bulkPut(entry.tags);
      }
      await db.removals.delete(id);
    });
  },
};
