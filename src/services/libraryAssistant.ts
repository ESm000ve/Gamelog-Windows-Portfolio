import { db } from "../db/schema";
import { aiRequest } from "./ai";
import { readParsedQuery } from "./aiContracts";
import { filterEntries, platformKey, type FilterSpec } from "./filterEngine";
import type { LibraryEntry, Status } from "../types";
export interface LibraryCriteria {
  titleQuery: string;
  filters: FilterSpec;
}
export interface LibraryInterpretation extends LibraryCriteria {
  mode: "ai" | "local";
  notice: string;
}
export function matchLibrary(entries: LibraryEntry[], criteria: LibraryCriteria): LibraryEntry[] {
  const query = criteria.titleQuery.trim().toLowerCase();
  return filterEntries(entries, criteria.filters)
    .filter((entry) => !query || entry.game.title.toLowerCase().includes(query))
    .sort((a, b) => a.game.title.localeCompare(b.game.title));
}
function canonicalGenre(value: string, genres: string[]): string {
  const aliases: Record<string, string> = {
    rpg: "role-playing",
    platformer: "platform",
    sim: "simulator",
    simulation: "simulator",
    sports: "sport",
  };
  const key = value.toLowerCase();
  return (
    genres.find(
      (genre) => genre.toLowerCase() === key || genre.toLowerCase().includes(aliases[key] ?? key)
    ) ?? value
  );
}
export function localLibraryCriteria(
  request: string,
  entries: LibraryEntry[],
  list = false
): LibraryCriteria {
  const q = request.toLowerCase();
  const filters: FilterSpec = {
    platformSource: "recorded",
    ...(list ? { status: ["Backlog" as Status] } : {}),
  };
  if (/\b(backlog|unstarted)\b/.test(q)) filters.status = ["Backlog"];
  else if (/\b(unplayed|not played)\b/.test(q)) filters.status = ["Backlog", "Wishlist"];
  else if (/\b(wishlist|wishlisted)\b/.test(q)) filters.status = ["Wishlist"];
  else if (/\b(playing|in progress)\b/.test(q)) filters.status = ["Playing"];
  else if (/\b(played|finished|completed)\b/.test(q)) filters.status = ["Played"];
  const numberWords: Record<string, string> = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    twelve: "12",
    twenty: "20",
  };
  const hours = request
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)\b/gi,
      (word) => numberWords[word.toLowerCase()]
    )
    .match(/(?:under|less than|up to|at most|within)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hours && Number(hours[1]) > 0 && Number(hours[1]) <= 10000)
    filters.timeToBeat = { max: Number(hours[1]) };
  const genres = [...new Set(entries.flatMap((entry) => entry.game.genres))];
  const terms = [...genres, "RPG", "Platformer", "Simulation", "Sports"];
  filters.genres = [
    ...new Set(
      terms
        .filter(
          (term) =>
            q.includes(term.toLowerCase()) &&
            !["no ", "not ", "without ", "not an ", "without any "].some((prefix) =>
              q.includes(prefix + term.toLowerCase())
            )
        )
        .map((term) => canonicalGenre(term, genres))
    ),
  ];
  if (!filters.genres.length) delete filters.genres;
  const platforms = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.log.platforms?.length
          ? entry.log.platforms
          : entry.log.platform
            ? [entry.log.platform]
            : entry.game.platforms.length === 1
              ? entry.game.platforms
              : []
      )
    ),
  ];
  filters.platforms = platforms.filter(
    (platform) =>
      q.includes(platform.toLowerCase()) ||
      ["pc", "switch", "ps5", "ps4", "ps3", "mac"].some(
        (alias) =>
          q.split(/[^a-z0-9]+/).includes(alias) && platformKey(alias) === platformKey(platform)
      )
  );
  if (!filters.platforms.length) delete filters.platforms;
  const quoted = request.match(/["“]([^"”]+)["”]/);
  const recognized =
    filters.genres?.length ||
    filters.platforms?.length ||
    filters.timeToBeat ||
    (!list && filters.status);
  return { titleQuery: quoted?.[1] ?? (!recognized && !list ? request.trim() : ""), filters };
}
export async function interpretLibraryRequest(
  request: string,
  entries: LibraryEntry[],
  list: boolean,
  signal: AbortSignal
): Promise<LibraryInterpretation> {
  if (!request.trim() || request.length > 2000)
    throw new Error("Enter a request of up to 2,000 characters.");
  try {
    const parsed = readParsedQuery(
      await aiRequest("parse-search", { query: request, scope: "library" }, signal)
    );
    signal.throwIfAborted();
    const genres = [...new Set(entries.flatMap((entry) => entry.game.genres))];
    const filters: FilterSpec = {
      platformSource: "recorded",
      ...(list ? { status: ["Backlog" as Status] } : {}),
    };
    if (parsed.filters.status)
      filters.status =
        parsed.filters.status === "Unplayed"
          ? ["Backlog", "Wishlist"]
          : [parsed.filters.status as Status];
    if (parsed.filters.genres?.length)
      filters.genres = [
        ...new Set(parsed.filters.genres.map((value) => canonicalGenre(value, genres))),
      ];
    if (parsed.filters.platforms?.length) filters.platforms = parsed.filters.platforms;
    if (parsed.filters.maxTime !== undefined) filters.timeToBeat = { max: parsed.filters.maxTime };
    if (parsed.filters.minRating !== undefined) filters.rating = { min: parsed.filters.minRating };
    return {
      titleQuery: parsed.igdbSearchQuery,
      filters,
      mode: "ai",
      notice:
        "AI suggested these criteria. Only the fields shown below will be applied; review them before continuing.",
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      ...localLibraryCriteria(request, entries, list),
      mode: "local",
      notice:
        (error instanceof Error ? error.message : "AI is unavailable.") +
        " Local draft shown. Review the fields: mood, exclusions and other details may need manual editing.",
    };
  }
}
export async function createReviewedList(
  name: string,
  ids: number[],
  criteria: LibraryCriteria
): Promise<string> {
  if (!name.trim() || name.trim().length > 80)
    throw new Error("Use a list name of 1 to 80 characters.");
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 20) throw new Error("Choose between 1 and 20 games.");
  return db.transaction("rw", [db.games, db.logs, db.lists], async () => {
    const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);
    const map = new Map(logs.map((log) => [log.igdbId, log]));
    const entries = games
      .filter((game) => map.has(game.igdbId))
      .map((game) => ({ game, log: map.get(game.igdbId)! }));
    const eligible = new Set(matchLibrary(entries, criteria).map((entry) => entry.game.igdbId));
    if (unique.some((id) => !eligible.has(id)))
      throw new Error("Your library changed. Review the matching games and try again.");
    const id = crypto.randomUUID(),
      now = Date.now();
    await db.lists.add({
      id,
      name: name.trim(),
      isRanked: false,
      gameIds: unique,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });
}
