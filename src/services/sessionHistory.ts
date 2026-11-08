import { db } from "../db/schema";
import { localDate } from "../utils/dates";
import type { Log } from "../types";
export type PlaySession = NonNullable<Log["playSessions"]>[number];
export function validateSessions(sessions: PlaySession[], today = localDate()): PlaySession[] {
  return sessions.map((session, index) => {
    const date = new Date(session.date + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(session.date) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== session.date ||
      session.date > today
    )
      throw new Error(`Session ${index + 1}: choose a valid date no later than today.`);
    const minutes = session.durationMinutes;
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440))
      throw new Error(`Session ${index + 1}: minutes must be between 0 and 1440, or left blank.`);
    return { date: session.date, ...(minutes !== undefined ? { durationMinutes: minutes } : {}) };
  });
}
export async function saveSessionHistory(
  igdbId: number,
  sessions: PlaySession[],
  expected: { createdAt: number; sessions: PlaySession[] }
) {
  const validated = validateSessions(sessions);
  return db.transaction("rw", [db.games, db.logs, db.removals], async () => {
    const [game, log] = await Promise.all([db.games.get(igdbId), db.logs.get(igdbId)]);
    if (!game || !log || log.createdAt !== expected.createdAt)
      throw new Error("This game was removed or replaced. Your draft was not saved.");
    if (JSON.stringify(log.playSessions ?? []) !== JSON.stringify(expected.sessions))
      throw new Error(
        "Session history changed elsewhere. Close and reopen this dialog to review the latest history."
      );
    const id = crypto.randomUUID();
    await db.removals.add({
      id,
      kind: "sessions",
      label: `${game.title} session history`,
      removedAt: Date.now(),
      gameId: igdbId,
      logCreatedAt: log.createdAt,
      before: log.playSessions ?? [],
      after: validated,
    });
    await db.logs.update(igdbId, { playSessions: validated, updatedAt: Date.now() });
    return id;
  });
}
