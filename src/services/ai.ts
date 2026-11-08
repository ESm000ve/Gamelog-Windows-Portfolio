import { localDate } from "../utils/dates";
import { readParsedLog, readParsedQuery, readInsights, validVector } from "./aiContracts";
import type { TasteAggregates } from "./stats";
export type { ParsedLogResult, ParsedQuery } from "./aiContracts";
export async function aiRequest(
  route: string,
  body: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await fetch("/api/ai/" + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "AI is unavailable. Please try again."
    );
  return data;
}
export async function embed(text: string, signal?: AbortSignal): Promise<number[]> {
  const data = await aiRequest("embed", { text }, signal);
  if (!data || typeof data !== "object" || !("embedding" in data) || !validVector(data.embedding))
    throw new Error("AI returned an invalid game match. Please try again.");
  return data.embedding;
}
export async function parseSearch(query: string, signal?: AbortSignal) {
  return readParsedQuery(await aiRequest("parse-search", { query }, signal));
}
export async function parseLog(text: string, signal?: AbortSignal) {
  return readParsedLog(await aiRequest("parse-log", { text, currentDate: localDate() }, signal));
}
export async function generateTasteInsights(
  aggregates: TasteAggregates,
  signal?: AbortSignal
): Promise<string[]> {
  if (aggregates.totalRated < 3)
    return ["Rate at least three games to get useful taste observations."];
  return readInsights(await aiRequest("taste-insights", aggregates, signal));
}
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!validVector(a) || !validVector(b) || a.length !== b.length) return 0;
  // Scaling avoids overflow when importing unusually large but finite components.
  const scaleA = Math.max(...a.map(Math.abs)),
    scaleB = Math.max(...b.map(Math.abs));
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] / scaleA,
      y = b[i] / scaleB;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return Math.max(-1, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}
