import { db } from "../schema";
import type { UserList } from "../../types";

export const ListsRepo = {
  /** Create a new empty list. */
  async create(name: string, isRanked = false): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const list: UserList = {
      id,
      name,
      isRanked,
      gameIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.lists.add(list);
    return id;
  },

  /** Update a list's metadata and/or game order. */
  async update(
    id: string,
    changes: Partial<Pick<UserList, "name" | "isRanked" | "gameIds">>
  ): Promise<void> {
    await db.lists.update(id, { ...changes, updatedAt: Date.now() });
  },

  /** Add a game to a list (if not already present). */
  async addGame(listId: string, igdbId: number): Promise<void> {
    const list = await db.lists.get(listId);
    if (!list || list.gameIds.includes(igdbId)) return;
    await db.lists.update(listId, {
      gameIds: [...list.gameIds, igdbId],
      updatedAt: Date.now(),
    });
  },

  /** Remove a game from a list. */
  async removeGame(listId: string, igdbId: number): Promise<void> {
    const list = await db.lists.get(listId);
    if (!list) return;
    await db.lists.update(listId, {
      gameIds: list.gameIds.filter((id) => id !== igdbId),
      updatedAt: Date.now(),
    });
  },

  /** Delete a list entirely. */
  async delete(id: string): Promise<void> {
    await db.lists.delete(id);
  },

  /** Get a list by ID. */
  async get(id: string): Promise<UserList | undefined> {
    return db.lists.get(id);
  },

  /** Get all lists. */
  async getAll(): Promise<UserList[]> {
    return db.lists.toArray();
  },
};
