import type { Log, Status, Completion, Ownership } from "../types/index.ts";
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const statuses: Status[] = ["Wishlist", "Backlog", "Playing", "Played"];
const completions: Completion[] = ["Completed", "Mastered", "Abandoned", "Shelved"];
const ownerships: Ownership[] = ["Physical", "Digital", "Subscription", "Borrowed"];
export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function text(value: unknown, max = 2000): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= max;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function invalid(): never {
  throw new Error(
    "AI returned an invalid response. Please try again or enter the details yourself."
  );
}
export function validVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 3072 &&
    value.every(finite) &&
    value.some((n) => n !== 0)
  );
}
export interface ParsedQuery {
  target: "igdb" | "library";
  igdbSearchQuery: string;
  filters: {
    genres?: string[];
    platforms?: string[];
    maxTime?: number;
    status?: string;
    minRating?: number;
  };
}
export function readParsedQuery(value: unknown): ParsedQuery {
  if (
    !record(value) ||
    !["igdb", "library"].includes(String(value.target)) ||
    typeof value.igdbSearchQuery !== "string" ||
    value.igdbSearchQuery.length > 200 ||
    !record(value.filters)
  )
    return invalid();
  const filters: ParsedQuery["filters"] = {};
  for (const key of ["genres", "platforms"] as const) {
    const v = value.filters[key];
    if (v !== undefined) {
      if (!Array.isArray(v) || v.length > 20 || !v.every((x) => text(x, 100))) return invalid();
      filters[key] = v;
    }
  }
  for (const key of ["maxTime", "minRating"] as const) {
    const v = value.filters[key];
    if (v !== undefined) {
      if (!finite(v) || v < 0 || v > (key === "minRating" ? 5 : 10000)) return invalid();
      filters[key] = v;
    }
  }
  if (value.filters.status !== undefined) {
    if (![...statuses, "Unplayed"].includes(value.filters.status as Status)) return invalid();
    filters.status = value.filters.status as string;
  }
  return {
    target: value.target as ParsedQuery["target"],
    igdbSearchQuery: value.igdbSearchQuery.trim(),
    filters,
  };
}
export interface ParsedLogResult {
  title: string;
  logFields: Partial<
    Pick<
      Log,
      | "status"
      | "completion"
      | "rating"
      | "platform"
      | "timePlayed"
      | "startedAt"
      | "finishedAt"
      | "ownership"
    >
  >;
}
export function readParsedLog(value: unknown): ParsedLogResult {
  if (!record(value) || !text(value.title, 200) || !record(value.logFields)) return invalid();
  const f = value.logFields;
  const out: ParsedLogResult["logFields"] = {};
  if (f.status !== undefined) {
    if (!statuses.includes(f.status as Status)) return invalid();
    out.status = f.status as Status;
  }
  if (f.completion !== undefined) {
    if (!completions.includes(f.completion as Completion) || out.status !== "Played")
      return invalid();
    out.completion = f.completion as Completion;
  }
  if (f.rating !== undefined) {
    if (!finite(f.rating) || f.rating < 0.5 || f.rating > 5 || !Number.isInteger(f.rating * 2))
      return invalid();
    out.rating = f.rating;
  }
  if (f.timePlayed !== undefined) {
    if (!finite(f.timePlayed) || f.timePlayed < 0 || f.timePlayed > 100000) return invalid();
    out.timePlayed = f.timePlayed;
  }
  if (f.platform !== undefined) {
    if (!text(f.platform, 100)) return invalid();
    out.platform = f.platform.trim();
  }
  for (const key of ["startedAt", "finishedAt"] as const) {
    if (f[key] !== undefined) {
      if (!validDate(f[key])) return invalid();
      out[key] = f[key];
    }
  }
  if (out.startedAt && out.finishedAt && out.finishedAt < out.startedAt) return invalid();
  if (f.ownership !== undefined) {
    if (
      !Array.isArray(f.ownership) ||
      !f.ownership.every((o) => ownerships.includes(o as Ownership))
    )
      return invalid();
    out.ownership = [...new Set(f.ownership)] as Ownership[];
  }
  return { title: value.title.trim(), logFields: out };
}
export function readPicks(
  value: unknown,
  ids: ReadonlySet<number>
): { id: number; reason: string }[] {
  if (!record(value) || !Array.isArray(value.picks)) return invalid();
  const seen = new Set<number>();
  return value.picks
    .filter((p): p is { id: number; reason: string } => {
      if (!record(p) || !finite(p.id) || !ids.has(p.id) || seen.has(p.id) || !text(p.reason, 500))
        return false;
      seen.add(p.id);
      return true;
    })
    .slice(0, 5)
    .map((p) => ({ id: p.id, reason: p.reason.trim() }));
}
export function readInsights(value: unknown): string[] {
  if (
    !record(value) ||
    !Array.isArray(value.insights) ||
    value.insights.length > 5 ||
    !value.insights.every((v) => text(v, 600))
  )
    return invalid();
  return [...new Set(value.insights.map((v) => (v as string).trim()))];
}
