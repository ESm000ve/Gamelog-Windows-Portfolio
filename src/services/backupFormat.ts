import type { Game, Log, UserList, Tag } from "../types";
export type BackupGame = Pick<Game, "igdbId" | "addedAt" | "updatedAt"> & Partial<Game>;
export interface BackupData {
  version: 1 | 2;
  exported?: string;
  games: BackupGame[];
  logs: Log[];
  lists: UserList[];
  tags?: Tag[];
}
const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const id = (value: unknown): value is number =>
  number(value) && Number.isSafeInteger(value) && value > 0;
const strings = (value: unknown) =>
  Array.isArray(value) && value.every((v) => typeof v === "string");
const timestamps = (value: Record<string, any>) =>
  number(value.createdAt) && number(value.updatedAt);
export function isFullGame(game: BackupGame): game is Game {
  return (
    typeof game.title === "string" &&
    typeof game.slug === "string" &&
    typeof game.developer === "string" &&
    number(game.releaseYear) &&
    strings(game.genres) &&
    strings(game.platforms)
  );
}
/** Validate everything before catalog requests or destructive database writes. */
export function parseBackup(json: string): BackupData {
  const data: unknown = JSON.parse(json);
  if (
    !object(data) ||
    ![1, 2].includes(data.version) ||
    !Array.isArray(data.games) ||
    !Array.isArray(data.logs) ||
    !Array.isArray(data.lists)
  )
    throw new Error("Invalid or unsupported backup format");
  const fail = () => {
    throw new Error("Invalid backup records");
  };
  for (const game of data.games) {
    if (!object(game) || !id(game.igdbId) || !number(game.addedAt) || !number(game.updatedAt))
      fail();
    if (data.version === 2 && !isFullGame(game)) fail();
  }
  const gameIds = new Set(data.games.map((g) => g.igdbId));
  if (gameIds.size !== data.games.length) fail();
  const logIds = new Set<number>();
  for (const log of data.logs) {
    if (
      !object(log) ||
      !gameIds.has(log.igdbId) ||
      logIds.has(log.igdbId) ||
      !timestamps(log) ||
      !["Wishlist", "Backlog", "Playing", "Played"].includes(log.status)
    )
      fail();
    logIds.add(log.igdbId);
    if (
      log.rating !== undefined &&
      (!number(log.rating) || log.rating < 0.5 || log.rating > 5 || (log.rating * 2) % 1 !== 0)
    )
      fail();
    if (log.timePlayed !== undefined && (!number(log.timePlayed) || log.timePlayed < 0)) fail();
    for (const key of ["tagIds", "platforms", "ownership"])
      if (log[key] !== undefined && !strings(log[key])) fail();
    for (const key of ["startedAt", "finishedAt"])
      if (
        log[key] !== undefined &&
        (typeof log[key] !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(log[key]) ||
          !number(Date.parse(log[key])))
      )
        fail();
    if (
      log.playSessions !== undefined &&
      (!Array.isArray(log.playSessions) ||
        log.playSessions.some(
          (s: unknown) =>
            !object(s) ||
            typeof s.date !== "string" ||
            !number(Date.parse(s.date)) ||
            (s.durationMinutes !== undefined &&
              (!number(s.durationMinutes) || s.durationMinutes < 0))
        ))
    )
      fail();
  }
  const listIds = new Set<string>();
  for (const list of data.lists) {
    if (
      !object(list) ||
      typeof list.id !== "string" ||
      listIds.has(list.id) ||
      typeof list.name !== "string" ||
      typeof list.isRanked !== "boolean" ||
      !timestamps(list) ||
      !Array.isArray(list.gameIds) ||
      list.gameIds.some((key: unknown) => !gameIds.has(key)) ||
      new Set(list.gameIds).size !== list.gameIds.length
    )
      fail();
    listIds.add(list.id);
  }
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) fail();
    const tagIds = new Set<string>();
    for (const tag of data.tags) {
      if (
        !object(tag) ||
        typeof tag.id !== "string" ||
        tagIds.has(tag.id) ||
        typeof tag.name !== "string" ||
        !timestamps(tag)
      )
        fail();
      tagIds.add(tag.id);
    }
    if (data.logs.some((log) => log.tagIds?.some((key: string) => !tagIds.has(key)))) fail();
  } else if (data.version === 2) fail();
  return data as unknown as BackupData;
}
