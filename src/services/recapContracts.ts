import type { RecapSource, RecapBullet, ResumeRecap } from "../types/recap.ts";
import { record, text, finite } from "./aiContracts.ts";
export function readRecapSources(value: unknown): RecapSource[] {
  if (!Array.isArray(value) || !value.length || value.length > 24)
    throw new Error("Choose between 1 and 24 note excerpts.");
  const seen = new Set<number>();
  let length = 0;
  const sources = value.map((source) => {
    if (
      !record(source) ||
      !finite(source.id) ||
      !Number.isSafeInteger(source.id) ||
      source.id < 1 ||
      seen.has(source.id) ||
      !text(source.text, 2000)
    )
      throw new Error("Invalid note excerpts. Please review the selected text.");
    seen.add(source.id);
    length += source.text.length;
    return { id: source.id, text: source.text };
  });
  if (length > 12000) throw new Error("Select up to 12,000 characters of notes.");
  return sources;
}
export function splitRecapSources(notes: string): RecapSource[] {
  if (notes.length > 12000) throw new Error("Select up to 12,000 characters of notes.");
  const chunks = notes
    .trim()
    .split(/\n+/)
    .flatMap((line) => {
      const result: string[] = [];
      for (let i = 0; i < line.length; i += 2000) {
        const part = line.slice(i, i + 2000).trim();
        if (part) result.push(part);
      }
      return result;
    });
  return readRecapSources(chunks.map((text, index) => ({ id: index + 1, text })));
}
export function readRecapBullets(value: unknown, sources: RecapSource[]): RecapBullet[] {
  if (
    !record(value) ||
    !Array.isArray(value.bullets) ||
    !value.bullets.length ||
    value.bullets.length > 6
  )
    throw new Error("AI returned an invalid recap. Your notes were not changed.");
  const ids = new Set(sources.map((source) => source.id));
  return value.bullets.map((bullet) => {
    if (
      !record(bullet) ||
      !text(bullet.text, 600) ||
      !Array.isArray(bullet.sourceIds) ||
      !bullet.sourceIds.length ||
      bullet.sourceIds.length > 24 ||
      !bullet.sourceIds.every((id) => typeof id === "number" && ids.has(id))
    )
      throw new Error("AI returned an uncited recap. Your notes were not changed.");
    return { text: bullet.text.trim(), sourceIds: [...new Set(bullet.sourceIds)] as number[] };
  });
}
export function readSavedRecap(value: unknown): ResumeRecap | null {
  try {
    if (!record(value) || !finite(value.savedAt) || !finite(value.sourceLogUpdatedAt)) return null;
    const sources = readRecapSources(value.sources);
    return {
      bullets: readRecapBullets(value, sources),
      sources,
      savedAt: value.savedAt,
      sourceLogUpdatedAt: value.sourceLogUpdatedAt,
    };
  } catch {
    return null;
  }
}
