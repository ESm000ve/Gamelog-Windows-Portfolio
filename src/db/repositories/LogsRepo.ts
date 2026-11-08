import { localDate } from "../../utils/dates";
import { db } from "../schema";
import type { Log, Status, Completion, Ownership } from "../../types";

export interface LogUpdate {
  status: Status;
  completion?: Completion;
  rating?: number;
  platform?: string;
  platforms?: string[];
  timePlayed?: number;
  startedAt?: string;
  finishedAt?: string;
  ownership?: Ownership[];
  notes?: string;
  tagIds?: string[];
  completionPercentage?: number;
  playSessions?: { date: string; durationMinutes?: number }[];
}

export const LogsRepo = {
  /** Save (overwrite) all editable log fields for a game. */
  async save(igdbId: number, update: LogUpdate): Promise<void> {
    await db.logs.update(igdbId, {
      ...update,
      // Clear completion if switching away from Played
      completion: update.status === "Played" ? update.completion : undefined,
      updatedAt: Date.now(),
    });
  },

  /** Update only the status field (quick action from UI). */
  async updateStatus(igdbId: number, status: Status): Promise<void> {
    await db.logs.update(igdbId, {
      status,
      ...(status !== "Played" ? { completion: undefined } : {}),
      updatedAt: Date.now(),
    });
  },

  /** Record today's activity once, without inventing an unprovided duration. */
  async logSession(igdbId: number): Promise<boolean> {
    return db.transaction("rw", db.logs, async () => {
      const log = await db.logs.get(igdbId);
      if (!log) throw new Error("This game is no longer in your library.");
      const today = localDate();
      const sessions = log.playSessions ?? [];
      if (sessions.some((session) => session.date === today)) return false;
      await db.logs.update(igdbId, {
        playSessions: [...sessions, { date: today }],
        updatedAt: Date.now(),
      });
      return true;
    });
  },

  /** Retrieves a log by its ID. */
  async get(igdbId: number): Promise<Log | undefined> {
    return db.logs.get(igdbId);
  },

  /** Retrieves all logs. */
  async getAll(): Promise<Log[]> {
    return db.logs.toArray();
  },
};
