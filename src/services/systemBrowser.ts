import type { Game, Log } from "../types/index.ts";

export interface SystemPlatform {
  id: number;
  name: string;
  abbreviation?: string;
  generation?: number;
  logoUrl?: string;
  releaseYear?: number;
  manufacturers: string[];
}
interface PlatformVersion {
  companies?: { company?: { name?: string }; manufacturer?: boolean }[];
  platform_version_release_dates?: { date?: number; y?: number }[];
  main_manufacturer?: { company?: { name?: string } };
}
interface RawPlatform {
  id: number;
  name: string;
  abbreviation?: string;
  generation?: number;
  platform_logo?: { image_id?: string };
  versions?: PlatformVersion[];
}
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function brand(name: string) {
  for (const [pattern, label] of [
    [/nintendo/i, "Nintendo"],
    [/sony/i, "Sony"],
    [/microsoft/i, "Microsoft"],
    [/sega/i, "Sega"],
    [/atari/i, "Atari"],
    [/oculus|meta platforms|facebook/i, "Meta"],
    [/apple/i, "Apple"],
    [/valve/i, "Valve"],
  ] as const)
    if (pattern.test(name)) return label;
  return name.trim();
}
function inferredManufacturer(name: string): string[] {
  const patterns: [RegExp, string][] = [
    [/nintendo|game boy|^wii|^family computer/i, "Nintendo"],
    [/playstation/i, "Sony"],
    [/^xbox/i, "Microsoft"],
    [/^sega|^dreamcast/i, "Sega"],
    [/^atari/i, "Atari"],
    [/^meta quest|^oculus/i, "Meta"],
    [/^mac$|^ios$/i, "Apple"],
    [/^steam/i, "Valve"],
    [/^nec|^pc engine|^pc-fx|^turbografx/i, "NEC"],
  ];
  return patterns.filter(([pattern]) => pattern.test(name)).map(([, label]) => label);
}
/** Uses the earliest documented hardware-version release, never a generation estimate. */
export function normalizeSystemPlatform(raw: RawPlatform): SystemPlatform {
  const versions = raw.versions ?? [];
  const years = versions.flatMap((version) =>
    (version.platform_version_release_dates ?? []).flatMap((release) => {
      const year =
        release.y ??
        (release.date && release.date > 0
          ? new Date(release.date * 1000).getUTCFullYear()
          : undefined);
      return year && year >= 1900 && year <= 2100 ? [year] : [];
    })
  );
  const manufacturers = [
    ...new Set(
      versions.flatMap((version) => {
        const names = [
          version.main_manufacturer?.company?.name,
          ...(version.companies ?? [])
            .filter((company) => company.manufacturer)
            .map((company) => company.company?.name),
        ];
        return names
          .filter((name): name is string => typeof name === "string" && /\p{L}/u.test(name))
          .map(brand);
      })
    ),
  ];
  return {
    id: raw.id,
    name: raw.name,
    abbreviation: raw.abbreviation,
    generation: raw.generation,
    logoUrl: raw.platform_logo?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_logo_med/${raw.platform_logo.image_id}.png`
      : undefined,
    releaseYear: years.length ? Math.min(...years) : undefined,
    manufacturers: [...new Set([...inferredManufacturer(raw.name), ...manufacturers])],
  };
}
const COMPUTER_NAMES = new Set([
  "pc (microsoft windows)",
  "mac",
  "linux",
  "web browser",
  "android",
  "ios",
]);
export function getSystemEra(platform: SystemPlatform): string {
  if (COMPUTER_NAMES.has(platform.name.toLowerCase())) return "Computers and mobile";
  return platform.releaseYear
    ? `${Math.floor(platform.releaseYear / 10) * 10}s`
    : "Release date unavailable";
}
export interface SystemCounts {
  games: number;
  backlog: number;
  playing: number;
}
/** Available catalog platforms are not treated as owned platforms on multi-platform games. */
export function getLibrarySystemCounts(platforms: SystemPlatform[], games: Game[], logs: Log[]) {
  const aliases = new Map<string, number>();
  platforms.forEach((platform) => {
    aliases.set(normalize(platform.name), platform.id);
    if (platform.abbreviation) aliases.set(normalize(platform.abbreviation), platform.id);
    if (platform.name === "PC (Microsoft Windows)") aliases.set("pc", platform.id);
  });
  const logMap = new Map(logs.map((log) => [log.igdbId, log]));
  const counts = new Map<number, SystemCounts>();
  let unassigned = 0;
  for (const game of games) {
    const log = logMap.get(game.igdbId);
    const selected = log?.platforms?.length
      ? log.platforms
      : log?.platform
        ? [log.platform]
        : game.platforms.length === 1
          ? game.platforms
          : [];
    const ids = new Set(
      selected
        .map((name) => aliases.get(normalize(name)))
        .filter((id): id is number => id !== undefined)
    );
    if (!ids.size) unassigned++;
    ids.forEach((id) => {
      const current = counts.get(id) ?? { games: 0, backlog: 0, playing: 0 };
      counts.set(id, {
        games: current.games + 1,
        backlog: current.backlog + (log?.status === "Backlog" ? 1 : 0),
        playing: current.playing + (log?.status === "Playing" ? 1 : 0),
      });
    });
  }
  return { counts, unassigned };
}
export type SystemSort = "name" | "name-desc" | "newest" | "oldest" | "library";
export function sortSystems(
  platforms: SystemPlatform[],
  sort: SystemSort,
  counts: Map<number, SystemCounts>
) {
  return [...platforms].sort((a, b) => {
    if (sort === "library")
      return (
        (counts.get(b.id)?.games ?? 0) - (counts.get(a.id)?.games ?? 0) ||
        a.name.localeCompare(b.name)
      );
    if (sort === "newest" || sort === "oldest") {
      if (!a.releaseYear || !b.releaseYear)
        return a.releaseYear ? -1 : b.releaseYear ? 1 : a.name.localeCompare(b.name);
      return (
        (sort === "newest" ? b.releaseYear - a.releaseYear : a.releaseYear - b.releaseYear) ||
        a.name.localeCompare(b.name)
      );
    }
    return (sort === "name-desc" ? -1 : 1) * a.name.localeCompare(b.name);
  });
}
export interface SystemBrowserState {
  view: "yours" | "all";
  query: string;
  manufacturer: string;
  sort: SystemSort;
  group: "era" | "manufacturer" | "none";
  collapsed: string[];
  scrollTop: number;
}
export const DEFAULT_SYSTEM_BROWSER: SystemBrowserState = {
  view: "yours",
  query: "",
  manufacturer: "all",
  sort: "name",
  group: "era",
  collapsed: [],
  scrollTop: 0,
};
export function parseSystemBrowserState(value: string | null): SystemBrowserState {
  try {
    const saved = JSON.parse(value ?? "null");
    if (!saved || typeof saved !== "object") return { ...DEFAULT_SYSTEM_BROWSER };
    return {
      view: saved.view === "all" ? "all" : "yours",
      query: typeof saved.query === "string" ? saved.query.slice(0, 200) : "",
      manufacturer: typeof saved.manufacturer === "string" ? saved.manufacturer : "all",
      sort: ["name", "name-desc", "newest", "oldest", "library"].includes(saved.sort)
        ? saved.sort
        : "name",
      group: ["era", "manufacturer", "none"].includes(saved.group) ? saved.group : "era",
      collapsed: Array.isArray(saved.collapsed)
        ? saved.collapsed.filter((item: unknown) => typeof item === "string").slice(0, 100)
        : [],
      scrollTop:
        typeof saved.scrollTop === "number" && Number.isFinite(saved.scrollTop)
          ? Math.max(0, saved.scrollTop)
          : 0,
    };
  } catch {
    return { ...DEFAULT_SYSTEM_BROWSER };
  }
}
