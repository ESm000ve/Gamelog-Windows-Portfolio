import type { Log } from "../types";
import type { GameDetail } from "../types/gameDetail";
import { validActivityDate } from "./activity";
import { localDate } from "../utils/dates";
export const RELATED_TABS = [
  "related",
  "dlcs",
  "expansions",
  "ports",
  "series",
  "mods",
  "bundles",
] as const;
export type RelatedTabKey = (typeof RELATED_TABS)[number];
export const RELATED_LABELS: Record<RelatedTabKey, string> = {
  related: "Related",
  dlcs: "DLC",
  expansions: "Expansions",
  ports: "Versions",
  series: "Series",
  mods: "Forks",
  bundles: "In bundles",
};
export const RELATED_DESCRIPTIONS: Record<RelatedTabKey, string> = {
  related: "Similar titles suggested from catalog information. Open a game to review its details.",
  dlcs: "Downloadable content listed for this game. Check the base-game requirements before purchasing.",
  expansions: "Expansions and standalone expansions listed for this game.",
  ports: "Ports, remakes and remasters. These may differ in content and supported platforms.",
  series: "Games sharing a catalog series or franchise. Use release sorting to explore chronology.",
  mods: "Games listed as forks of this title in the catalog.",
  bundles: "Collections and bundles that include this game. Contents may vary by edition.",
};
export function resolveRelatedTab(
  detail: GameDetail,
  requested: string | null
): RelatedTabKey | null {
  const available = RELATED_TABS.filter((tab) => detail.related[tab]?.length);
  return available.includes(requested as RelatedTabKey)
    ? (requested as RelatedTabKey)
    : (available[0] ?? null);
}
export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  let url = value.trim();
  if (url.startsWith("//")) url = "https:" + url;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = "https://" + url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function detailScore(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? Math.round(value)
    : undefined;
}
export function personalActivity(log: Log, today = localDate()) {
  const sessions = (log.playSessions ?? []).filter((session) =>
    validActivityDate(session.date, today)
  );
  const dated = sessions.map((session) => session.date).sort();
  const known = sessions.filter(
    (session) =>
      typeof session.durationMinutes === "number" &&
      Number.isFinite(session.durationMinutes) &&
      session.durationMinutes >= 0 &&
      session.durationMinutes <= 1440
  );
  return {
    sessions: sessions.length,
    lastPlayed: dated.at(-1),
    sessionHours: Number(
      (known.reduce((sum, session) => sum + session.durationMinutes!, 0) / 60).toFixed(1)
    ),
    unknownDuration: sessions.length - known.length,
  };
}
export function firstReleaseLabel(detail: Pick<GameDetail, "firstReleaseDate" | "releaseYear">) {
  if (
    typeof detail.firstReleaseDate === "number" &&
    Number.isFinite(detail.firstReleaseDate) &&
    detail.firstReleaseDate > 0
  ) {
    const date = new Date(detail.firstReleaseDate * 1000);
    if (Number.isFinite(date.getTime()))
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
  }
  return detail.releaseYear >= 1900 && detail.releaseYear <= 2100
    ? String(detail.releaseYear)
    : "Not listed";
}
