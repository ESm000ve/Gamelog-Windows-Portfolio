import { db } from "./schema";
import type { RecoveryEntry } from "../types/recovery";
export async function captureLibrarySnapshot(label: string) {
  const [games, logs, lists, tags] = await Promise.all([
    db.games.toArray(),
    db.logs.toArray(),
    db.lists.toArray(),
    db.tags.toArray(),
  ]);
  const entry: RecoveryEntry = {
    id: crypto.randomUUID(),
    label,
    removedAt: Date.now(),
    kind: "library",
    games,
    logs,
    lists,
    tags,
  };
  await db.removals.add(entry);
  return entry.id;
}
