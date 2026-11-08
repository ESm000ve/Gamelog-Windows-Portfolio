/**
 * Database schema & migration definitions.
 *
 * ADDING A NEW VERSION:
 *   1. Append a new `this.version(N).stores({ ... })` block.
 *   2. If a column is being removed or renamed, add a `.upgrade(tx => {...})`.
 *   3. Never modify an existing version block — Dexie uses them to detect
 *      what the browser has installed vs. what the app needs.
 *
 * Field notation:
 *   "fieldName"   — indexed, non-unique
 *   "++fieldName" — auto-incremented primary key
 *   "&fieldName"  — indexed, unique
 *   "[a+b]"       — compound index
 *   "*fieldName"  — multi-entry index (arrays)
 *
 * Only fields listed here are indexed. All other fields on the TypeScript
 * interface are still stored — they just can't be used in .where() queries.
 */

import type { RecoveryEntry } from "../types/recovery";
import Dexie, { type Table } from "dexie";
import type { Game, Log, UserList, Tag } from "../types";

export class GamelogDB extends Dexie {
  removals!: Table<RecoveryEntry, string>;
  games!: Table<Game, number>; // primary key: igdbId (number)
  logs!: Table<Log, number>; // primary key: igdbId (number)
  lists!: Table<UserList, string>; // primary key: id (UUID string)
  tags!: Table<Tag, string>; // primary key: id (UUID string)

  constructor() {
    super("gamelog");

    // ── v1 ──────────────────────────────────────────────────────────────────
    // Initial schema: games catalog cache, personal logs, and user lists.
    this.version(1).stores({
      games: [
        "igdbId", // PK — IGDB integer ID
        "title", // for title-sort queries
        "releaseYear", // for year-sort queries
        "addedAt", // for recently-added sort (default)
        "updatedAt", // for change-tracking
      ].join(", "),

      logs: [
        "igdbId", // PK — FK → games.igdbId
        "status", // for status-filter queries
        "finishedAt", // for "played this year" stats
        "updatedAt",
      ].join(", "),

      lists: [
        "id", // PK — UUID
        "name", // for name-sort queries
        "createdAt",
        "updatedAt",
      ].join(", "),
    });

    // ── v2 ──────────────────────────────────────────────────────────────────
    // Added tags table and *tagIds to logs
    this.version(2)
      .stores({
        games: "igdbId, title, releaseYear, addedAt, updatedAt",
        logs: "igdbId, status, finishedAt, updatedAt, *tagIds",
        lists: "id, name, createdAt, updatedAt",
        tags: "id, name, createdAt, updatedAt",
      })
      .upgrade(async (tx) => {
        // Ensure existing logs have tagIds initialized
        await tx
          .table("logs")
          .toCollection()
          .modify((log) => {
            if (!log.tagIds) log.tagIds = [];
          });
      });

    // ── v3 ──────────────────────────────────────────────────────────────────
    // Added playSessions to logs, deal price fields to games
    this.version(3)
      .stores({
        games: "igdbId, title, releaseYear, addedAt, updatedAt",
        logs: "igdbId, status, finishedAt, updatedAt, *tagIds",
        lists: "id, name, createdAt, updatedAt",
        tags: "id, name, createdAt, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("logs")
          .toCollection()
          .modify((log) => {
            if (!log.playSessions) log.playSessions = [];
          });
      });
    // Recovery records are committed atomically with the destructive operation.
    this.version(4).stores({ removals: "id, kind, removedAt" });
  }
}

/** Singleton — the only Dexie instance in the app. */
export const db = new GamelogDB();
