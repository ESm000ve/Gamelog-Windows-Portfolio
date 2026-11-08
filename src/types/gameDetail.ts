import { cleanRelatedGames, browseRelated } from "../services/relatedGames";
import { safeExternalUrl, detailScore } from "../services/gameDetailPresentation";
import type { TimeToBeat } from "../types";

// ─── Slim related game (from IGDB relationship arrays) ───────────────────────
export interface RelatedGameSlim {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id: string };
  first_release_date?: number;
  total_rating_count?: number;
  category?: number;
  game_type?: { id?: number; type?: string };
}

// ─── Age rating categories from IGDB ────────────────────────────────────────
export interface AgeRating {
  category: number; // 1=ESRB, 2=PEGI, 3=CERO, etc.
  rating: number; // numeric enum for the rating label
  content_descriptions?: { description: string; category: number }[];
}

// ─── Full raw detail from /api/igdb/detail ───────────────────────────────────
export interface IgdbGameDetail {
  id: number;
  name: string;
  slug: string;
  first_release_date?: number;
  summary?: string;
  storyline?: string;
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  genres?: { id?: number; name: string }[];
  themes?: { id?: number; name: string }[];
  keywords?: { id?: number; name: string }[];
  game_engines?: { id?: number; name: string }[];
  game_type?: number;
  platforms?: { name: string; abbreviation?: string }[];
  release_dates?: { human: string; date?: number; region?: number; platform?: { name: string } }[];
  involved_companies?: {
    company: { name: string };
    developer?: boolean;
    publisher?: boolean;
    porting?: boolean;
    supporting?: boolean;
  }[];
  cover?: { image_id: string };
  screenshots?: { image_id: string }[];
  artworks?: { image_id: string }[];
  videos?: { video_id: string; name: string }[];
  language_supports?: { language?: { name: string }; language_support_type?: { name: string } }[];
  game_modes?: { name: string }[];
  multiplayer_modes?: any[];
  player_perspectives?: { name: string }[];
  age_ratings?: AgeRating[];
  alternative_names?: { name: string; comment?: string }[];
  websites?: { url: string; category: number }[];
  franchises?: { name: string; slug: string; games?: RelatedGameSlim[] }[];
  collections?: { name: string; slug: string; games?: RelatedGameSlim[] }[];
  similar_games?: RelatedGameSlim[];
  dlcs?: RelatedGameSlim[];
  expansions?: RelatedGameSlim[];
  standalone_expansions?: RelatedGameSlim[];
  ports?: RelatedGameSlim[];
  remakes?: RelatedGameSlim[];
  remasters?: RelatedGameSlim[];
  bundles?: RelatedGameSlim[];
  forks?: RelatedGameSlim[];
  _custom_related?: RelatedGameSlim[]; // Injected by our server proxy
}

// ─── Response from /api/igdb/detail ─────────────────────────────────────────
export interface GameDetailResponse {
  game: IgdbGameDetail | null;
  timeToBeat: TimeToBeat | null;
}

// ─── Normalized game detail (used by the UI) ─────────────────────────────────

export interface RelatedGames {
  related: RelatedGameSlim[];
  dlcs: RelatedGameSlim[];
  expansions: RelatedGameSlim[]; // expansions + standalone_expansions
  ports: RelatedGameSlim[]; // ports + remakes + remasters
  series: RelatedGameSlim[]; // from franchises/collections
  mods: RelatedGameSlim[]; // forks
  bundles: RelatedGameSlim[];
}

export interface SeriesGroup {
  id: string;
  name: string;
  kind: "collection" | "franchise";
  gameIds: number[];
}

export interface RatingDetails {
  score?: number;
  count?: number;
}

export interface Company {
  name: string;
  roles: string[];
}

export interface MediaImage {
  url: string;
}

export interface MediaVideo {
  videoId: string;
  name: string;
}

export interface ReleaseDate {
  date: string;
  region?: string;
  platform?: string;
}

export interface LanguageSupport {
  language: string;
  types: string[];
}

export interface Website {
  url: string;
  categoryName: string;
}

export interface GameDetail {
  igdbId: number;
  title: string;
  slug: string;
  companies: Company[];
  /** Convenience accessor — the first company with a "Developer" role, if any. */
  developer?: string;
  /** Convenience accessor — the first company with a "Publisher" role, if any. */
  publisher?: string;
  releaseYear: number;
  firstReleaseDate?: number;
  summary?: string;
  storyline?: string;
  genres: string[];
  themes: string[];
  keywords: string[];
  engines: string[];
  platforms: string[];
  releaseDates: ReleaseDate[];
  coverUrl?: string;
  screenshots: MediaImage[];
  artworks: MediaImage[];
  videos: MediaVideo[];
  igdbRating: RatingDetails;
  criticRating: RatingDetails;
  gameModes: string[];
  multiplayer?: any[];
  formattedMultiplayer: string[];
  playerPersp: string[];
  ageRatings: string[];
  ageDescriptors: string[];
  franchise?: string;
  altNames: { name: string; comment?: string }[];
  websites: Website[];
  languages: LanguageSupport[];
  timeToBeat: TimeToBeat | null;
  related: RelatedGames;
  seriesGroups?: SeriesGroup[];
}

// ─── IGDB cover URL helper ───────────────────────────────────────────────────
export function igdbImageUrl(imageId: string, size = "1080p"): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function coverUrl(imageId: string, size = "cover_big"): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

// ─── IGDB Mappings ────────────────────────────────────────────────────────────
const ESRB_LABELS: Record<number, string> = {
  6: "RP",
  7: "EC",
  8: "E",
  9: "E10+",
  10: "T",
  11: "M",
  12: "AO",
};
const PEGI_LABELS: Record<number, string> = { 1: "3", 2: "7", 3: "12", 4: "16", 5: "18" };

function formatAgeRating(r: AgeRating): string | null {
  if (r.category === 1) return ESRB_LABELS[r.rating] ? `ESRB: ${ESRB_LABELS[r.rating]}` : null;
  if (r.category === 2) return PEGI_LABELS[r.rating] ? `PEGI: ${PEGI_LABELS[r.rating]}` : null;
  return null;
}

const REGION_LABELS: Record<number, string> = {
  1: "Europe",
  2: "North America",
  3: "Australia",
  4: "New Zealand",
  5: "Japan",
  6: "China",
  7: "Asia",
  8: "Worldwide",
  9: "Korea",
  10: "Brazil",
};

const WEBSITE_LABELS: Record<number, string> = {
  1: "Official",
  2: "Wikia",
  3: "Wikipedia",
  4: "Facebook",
  5: "Twitter",
  6: "Twitch",
  8: "Instagram",
  9: "YouTube",
  10: "iPhone",
  11: "iPad",
  12: "Android",
  13: "Steam",
  14: "Reddit",
  15: "Itch",
  16: "Epic Games",
  17: "GOG",
  18: "Discord",
};

// ─── Normalize raw IGDB detail → GameDetail ───────────────────────────────────
export function normalizeDetail(raw: IgdbGameDetail, timeToBeat: TimeToBeat | null): GameDetail {
  const franchise = raw.franchises?.[0]?.name ?? raw.collections?.[0]?.name;

  // Extract all series games, sort by release year
  const seriesGamesMap = new Map<number, RelatedGameSlim>();
  (raw.franchises || []).forEach((f) =>
    (f.games || []).forEach((g) => {
      if (g.id !== raw.id) seriesGamesMap.set(g.id, g);
    })
  );
  (raw.collections || []).forEach((c) =>
    (c.games || []).forEach((g) => {
      if (g.id !== raw.id) seriesGamesMap.set(g.id, g);
    })
  );

  const series = Array.from(seriesGamesMap.values());
  const seriesGroups: SeriesGroup[] = [];
  for (const [kind, groups] of [
    ["collection", raw.collections],
    ["franchise", raw.franchises],
  ] as const) {
    for (const group of groups ?? []) {
      if (!group.name?.trim()) continue;
      const gameIds = cleanRelatedGames(group.games ?? [], raw.id).map((game) => game.id);
      if (gameIds.length)
        seriesGroups.push({
          id: `${kind}:${group.slug || group.name.trim().toLocaleLowerCase()}`,
          name: group.name.trim(),
          kind,
          gameIds,
        });
    }
  }

  const related =
    raw._custom_related && raw._custom_related.length > 0
      ? raw._custom_related
      : (raw.similar_games ?? []);

  // Companies mapping
  const companiesMap = new Map<string, string[]>();
  raw.involved_companies?.forEach((ic) => {
    const roles: string[] = [];
    if (ic.developer) roles.push("Developer");
    if (ic.publisher) roles.push("Publisher");
    if (ic.porting) roles.push("Porting");
    if (ic.supporting) roles.push("Supporting");
    if (roles.length > 0) {
      const existing = companiesMap.get(ic.company.name) || [];
      companiesMap.set(ic.company.name, Array.from(new Set([...existing, ...roles])));
    }
  });
  const companies = Array.from(companiesMap.entries()).map(([name, roles]) => ({ name, roles }));
  const developer = companies.find((c) => c.roles.includes("Developer"))?.name;
  const publisher = companies.find((c) => c.roles.includes("Publisher"))?.name;

  // Release dates
  const releaseDates: ReleaseDate[] = (raw.release_dates || []).map((rd) => ({
    date: rd.human,
    region: rd.region ? REGION_LABELS[rd.region] : undefined,
    platform: rd.platform?.name,
  }));

  // Language mapping
  const langMap = new Map<string, string[]>();
  raw.language_supports?.forEach((ls) => {
    const lang = ls.language?.name;
    const type = ls.language_support_type?.name;
    if (lang && type) {
      const existing = langMap.get(lang) || [];
      if (!existing.includes(type)) existing.push(type);
      langMap.set(lang, existing);
    }
  });
  const languages = Array.from(langMap.entries()).map(([language, types]) => ({ language, types }));

  const websites: Website[] = [
    ...new Map(
      (raw.websites ?? [])
        .flatMap((website) => {
          const url = safeExternalUrl(website.url);
          if (!url) return [];
          return [
            {
              url,
              categoryName:
                WEBSITE_LABELS[website.category] ?? new URL(url).hostname.replace(/^www\./, ""),
            },
          ];
        })
        .map((website) => [website.url, website])
    ).values(),
  ];

  // Age Descriptors
  const ageDescriptorsSet = new Set<string>();
  raw.age_ratings?.forEach((ar) => {
    ar.content_descriptions?.forEach((desc) => {
      if (desc.description) ageDescriptorsSet.add(desc.description);
    });
  });

  // Multiplayer mapping
  const formattedMultiplayer: string[] = [];
  raw.multiplayer_modes?.forEach((mm) => {
    const parts: string[] = [];
    if (mm.campaigncoop) parts.push("Campaign Co-op");
    if (mm.offlinecoop)
      parts.push(`Offline Co-op${mm.offlinecoopmax ? ` (max ${mm.offlinecoopmax})` : ""}`);
    else if (mm.offlinemax && mm.offlinemax > 1) parts.push(`Offline max ${mm.offlinemax}`);
    if (mm.onlinecoop)
      parts.push(`Online Co-op${mm.onlinecoopmax ? ` (max ${mm.onlinecoopmax})` : ""}`);
    else if (mm.onlinemax && mm.onlinemax > 1) parts.push(`Online max ${mm.onlinemax}`);
    if (mm.splitscreen) parts.push(`Splitscreen${mm.splitscreenonline ? " (Online)" : ""}`);
    if (parts.length > 0) formattedMultiplayer.push(parts.join(", "));
  });

  function sortGames(arr: RelatedGameSlim[], allowBundles = false) {
    // Exclude bundles from related game lists to avoid cluttering with compilations
    const valid = cleanRelatedGames(arr, raw.id).filter(
      (game) => allowBundles || game.category !== 3
    );

    return valid.sort((a, b) => {
      // 1. Popularity (total_rating_count DESC, null goes to bottom)
      const countA = a.total_rating_count ?? -1;
      const countB = b.total_rating_count ?? -1;
      if (countA !== countB) return countB - countA;

      // 2. Release date (newest first)
      const dateA = a.first_release_date ?? -1;
      const dateB = b.first_release_date ?? -1;
      if (dateA !== dateB) return dateB - dateA;

      // 3. Name (A-Z)
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  return {
    igdbId: raw.id,
    title: raw.name,
    slug: raw.slug,
    companies,
    developer,
    publisher,
    releaseYear: raw.first_release_date
      ? new Date(raw.first_release_date * 1000).getUTCFullYear()
      : 0,
    firstReleaseDate: raw.first_release_date,
    summary: raw.summary,
    storyline: raw.storyline,
    genres: raw.genres?.map((g) => g.name) ?? [],
    themes: raw.themes?.map((t) => t.name) ?? [],
    keywords: raw.keywords?.map((k) => k.name) ?? [],
    engines: raw.game_engines?.map((e) => e.name) ?? [],
    platforms: raw.platforms?.map((p) => p.name) ?? [],
    releaseDates,
    coverUrl: raw.cover ? igdbImageUrl(raw.cover.image_id, "cover_big") : undefined,
    screenshots: (raw.screenshots || []).map((s) => ({ url: igdbImageUrl(s.image_id) })),
    artworks: (raw.artworks || []).map((a) => ({ url: igdbImageUrl(a.image_id) })),
    videos: (raw.videos || []).map((v) => ({ videoId: v.video_id, name: v.name })),
    igdbRating: { score: detailScore(raw.rating), count: raw.rating_count },
    criticRating: {
      score: detailScore(raw.aggregated_rating),
      count: raw.aggregated_rating_count,
    },
    gameModes: raw.game_modes?.map((m) => m.name) ?? [],
    multiplayer: raw.multiplayer_modes ?? [],
    formattedMultiplayer,
    playerPersp: raw.player_perspectives?.map((p) => p.name) ?? [],
    ageRatings: (raw.age_ratings ?? []).map(formatAgeRating).filter(Boolean) as string[],
    ageDescriptors: Array.from(ageDescriptorsSet),
    franchise,
    altNames: raw.alternative_names ?? [],
    websites,
    languages,
    timeToBeat,
    seriesGroups,
    related: {
      related: cleanRelatedGames(related, raw.id, true),
      dlcs: sortGames(raw.dlcs ?? []),
      expansions: sortGames([...(raw.expansions ?? []), ...(raw.standalone_expansions ?? [])]),
      ports: sortGames([...(raw.ports ?? []), ...(raw.remakes ?? []), ...(raw.remasters ?? [])]),
      series: browseRelated(
        cleanRelatedGames(series, raw.id),
        { query: "", scope: "all", sort: "oldest" },
        new Set()
      ),
      mods: sortGames(raw.forks ?? []),
      bundles: sortGames(raw.bundles ?? [], true), // Keep bundles in the 'bundles' tab but sorted
    },
  };
}
