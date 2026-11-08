import { relatedCategory } from "../src/services/gameClassification.ts";
import { searchTitle } from "../src/services/titleSearch.ts";
import type { MinimalRequest } from "./httpTypes.ts";
export class CatalogQueryError extends Error {
  statusCode = 400;
}
export function readCatalogIds(req: MinimalRequest): Promise<number[]> {
  return new Promise((resolve, reject) => {
    let body = "",
      bytes = 0,
      failed = false;
    const fail = (error: Error) => {
      if (!failed) {
        failed = true;
        clearTimeout(timer);
        reject(error);
      }
    };
    const timer = setTimeout(
      () => fail(new CatalogQueryError("The catalog request took too long.")),
      15000
    );
    req.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 524288) fail(new CatalogQueryError("The library filter is too large."));
      else if (!failed) body += chunk.toString();
    });
    req.on("end", () => {
      clearTimeout(timer);
      if (failed) return;
      try {
        const value = JSON.parse(body)?.ids;
        if (
          !Array.isArray(value) ||
          value.length > 20000 ||
          value.some((id) => !Number.isSafeInteger(id) || id < 1)
        )
          throw new Error();
        resolve([...new Set(value)]);
      } catch {
        fail(new CatalogQueryError("Send a valid list of library game IDs."));
      }
    });
    req.on("aborted", () => fail(new CatalogQueryError("The request was interrupted.")));
    req.on("error", () => fail(new CatalogQueryError("The request was interrupted.")));
  });
}
const roman = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
];
export function catalogTitleClause(query: string) {
  const termClause = (term: string) => {
    if (!/^\d+$/.test(term)) return `name ~ *${JSON.stringify(term)}*`;
    const alternatives = [term, roman[Number(term)]].filter(Boolean);
    // Match complete sequel numbers, so 7 / VII never accidentally matches 17 / XVII.
    const patterns = alternatives.flatMap((value) => [
      `name ~ ${JSON.stringify(value)}`,
      ...[" ", ":", "-", ".", "/", ")", "™", "®"].map(
        (end) => `name ~ *${JSON.stringify(" " + value + end)}*`
      ),
      `name ~ *${JSON.stringify(" " + value)}`,
      `name ~ ${JSON.stringify(value + " ")}*`,
    ]);
    return `(${patterns.join(" | ")})`;
  };
  const tokens = [...new Set(query.match(/[\p{L}\p{N}]+/gu) ?? [])];
  return tokens
    .map((token) => {
      const normalized = searchTitle(token).split(" ").filter(Boolean).map(termClause).join(" & ");
      // Alphanumeric titles such as F1 and WWE 2K24 also need their literal form.
      return /\p{L}/u.test(token) && /\d/.test(token)
        ? `(name ~ *${JSON.stringify(token.toLowerCase())}* | (${normalized}))`
        : normalized;
    })
    .filter(Boolean)
    .join(" & ");
}
export function buildSystemCatalogQuery(
  params: URLSearchParams,
  ids: number[],
  types: { id: number; type: string }[]
) {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    const value = raw === null || raw === "" ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw new CatalogQueryError(`Invalid ${key}`);
    return value;
  };
  const platformId = integer("platformId", 0, 1, Number.MAX_SAFE_INTEGER);
  const limit = integer("limit", 50, 1, 50),
    offset = integer("offset", 0, 0, Number.MAX_SAFE_INTEGER);
  const sort = params.get("sort") || "popularity";
  const sorts: Record<string, string> = {
    popularity: "total_rating_count desc",
    release_desc: "first_release_date desc",
    release_asc: "first_release_date asc",
    name: "name asc",
    rating: "total_rating desc",
  };
  if (!sorts[sort]) throw new CatalogQueryError("Invalid sort");
  const type = params.get("type") || (params.get("includeAll") === "true" ? "all" : "playable");
  const categories: Record<string, number[]> = {
    playable: [0, 4, 8, 9, 10, 11],
    games: [0, 4],
    versions: [8, 9, 10, 11],
    addons: [1, 2],
    bundles: [3],
    other: [5, 6, 7, 12, 13, 14],
  };
  if (!["all", "unknown", ...Object.keys(categories)].includes(type))
    throw new CatalogQueryError("Invalid game type");
  const scope = params.get("library") || "all";
  if (!["all", "in", "new"].includes(scope)) throw new CatalogQueryError("Invalid library filter");
  const clauses = [`platforms = (${platformId})`];
  const validTypes = types.filter((row) => Number.isSafeInteger(row.id) && row.id >= 0);
  if (type !== "all") {
    const selected = validTypes
      .filter((row) =>
        type === "unknown"
          ? relatedCategory({ game_type: row }) !== undefined
          : categories[type].includes(relatedCategory({ game_type: row }) ?? -1)
      )
      .map((row) => row.id);
    clauses.push(
      type === "unknown"
        ? selected.length
          ? `(game_type = null | game_type != (${selected.join(",")}))`
          : "game_type = null"
        : selected.length
          ? `game_type = (${selected.join(",")})`
          : "id = 0"
    );
  }
  if (scope === "in") clauses.push(ids.length ? `id = (${ids.join(",")})` : "id = 0");
  if (scope === "new" && ids.length) clauses.push(`id != (${ids.join(",")})`);
  if (params.get("genre")) clauses.push(`genres = (${integer("genre", 0, 1, 100000)})`);
  const start = params.get("startYear") ? integer("startYear", 0, 1900, 2100) : undefined;
  const end = params.get("endYear") ? integer("endYear", 0, 1900, 2100) : undefined;
  if (start && end && start > end)
    throw new CatalogQueryError("The start year must be before or equal to the end year.");
  if (start) clauses.push(`first_release_date >= ${Date.UTC(start, 0, 1) / 1000}`);
  if (end) clauses.push(`first_release_date <= ${Date.UTC(end + 1, 0, 1) / 1000 - 1}`);
  if (params.get("minRating")) clauses.push(`total_rating >= ${integer("minRating", 0, 0, 100)}`);
  const query = params.get("q")?.trim() ?? "";
  if (query.length > 120 || searchTitle(query).split(" ").length > 12)
    throw new CatalogQueryError("Use a title search of up to 120 characters and 12 words.");
  if (query) {
    const title = catalogTitleClause(query);
    if (title) clauses.push(`(${title})`);
  }
  return {
    platformId,
    limit,
    body: `where ${clauses.join(" & ")}; fields name, slug, cover.image_id, first_release_date, release_dates.date, release_dates.platform, total_rating, total_rating_count, genres.name, game_type.type; sort ${sorts[sort]}; limit ${limit}; offset ${offset};`,
  };
}
