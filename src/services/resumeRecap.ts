import { db } from "../db/schema";
import { aiRequest } from "./ai";
import { splitRecapSources, readRecapSources, readRecapBullets } from "./recapContracts";
import type { RecapBullet, RecapSource, ResumeRecap } from "../types/recap";
export interface RecapDraft {
  bullets: RecapBullet[];
  sources: RecapSource[];
}
export async function generateResumeRecap(
  title: string,
  selectedNotes: string,
  consent: boolean,
  signal: AbortSignal
): Promise<RecapDraft> {
  if (!consent)
    throw new Error(
      "Choose whether to send the selected excerpts to Gemini before generating a recap."
    );
  const sources = splitRecapSources(selectedNotes);
  const result = await aiRequest("resume-recap", { title, sources, consent: true }, signal);
  signal.throwIfAborted();
  return { sources, bullets: readRecapBullets(result, sources) };
}
export async function saveResumeRecap(
  igdbId: number,
  draft: RecapDraft,
  expected: { notes: string; createdAt: number }
): Promise<ResumeRecap> {
  const sources = readRecapSources(draft.sources),
    bullets = readRecapBullets(draft, sources);
  return db.transaction("rw", [db.games, db.logs], async () => {
    const [game, log] = await Promise.all([db.games.get(igdbId), db.logs.get(igdbId)]);
    if (!game || !log)
      throw new Error("This game is no longer in your library. The recap was not saved.");
    if ((log.notes ?? "") !== expected.notes || log.createdAt !== expected.createdAt)
      throw new Error(
        "Your notes changed. Review the latest notes and generate a new recap before saving."
      );
    const now = Date.now();
    const recap: ResumeRecap = { bullets, sources, savedAt: now, sourceLogUpdatedAt: now };
    await db.logs.update(igdbId, { resumeRecap: recap, updatedAt: now });
    return recap;
  });
}
