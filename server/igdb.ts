import {
  buildSystemCatalogQuery,
  readCatalogIds,
  CatalogQueryError,
} from "./systemCatalogQuery.ts";
import { relatedCategory } from "../src/services/gameClassification.ts";
import { normalizeSystemPlatform } from "../src/services/systemBrowser.ts";
import type { Plugin, ViteDevServer } from "vite";
import { config as dotenvConfig } from "dotenv";
import type { MinimalRequest, MinimalResponse } from "./httpTypes.ts";

dotenvConfig({ quiet: true });
const envCache: Record<string, string> = process.env as Record<string, string>;
let token: string | null = null;

async function getToken(): Promise<string> {
  if (token) return token;

  const clientId = envCache.IGDB_CLIENT_ID;
  const clientSecret = envCache.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("IGDB_CLIENT_ID or IGDB_CLIENT_SECRET is missing from .env");
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) {
    throw new Error(`Failed to get IGDB token: ${res.statusText}`);
  }

  const json = (await res.json()) as { access_token: string };
  token = json.access_token;
  return token;
}

async function igdbFetch(endpoint: string, body: string, retryCount = 1): Promise<unknown[]> {
  const t = await getToken();
  const clientId = envCache.IGDB_CLIENT_ID!;

  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${t}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  if (res.status === 401 && retryCount > 0) {
    console.log("[IGDB] Token expired or invalid, refreshing...");
    token = null; // Clear cached token
    return igdbFetch(endpoint, body, retryCount - 1);
  }

  if (!res.ok) {
    throw new Error(`IGDB fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<unknown[]>;
}

export function attachIgdbRoutes(app: any) {
  // ─── Search endpoint ──────────────────────────────────────────────────
  app.use("/api/igdb/search", async (req: MinimalRequest, res: MinimalResponse) => {
    try {
      const queryStr = req.originalUrl?.split("?")[1] ?? "";
      const params = new URLSearchParams(queryStr);
      const q = params.get("q")?.trim();
      if (!q) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing q" }));
        return;
      }
      const limitStr = params.get("limit");
      const offsetStr = params.get("offset");
      const reqLimit = limitStr ? Number(limitStr) : 8;
      const reqOffset = offsetStr ? Number(offsetStr) : 0;
      if (
        !Number.isInteger(reqLimit) ||
        reqLimit < 1 ||
        reqLimit > 50 ||
        !Number.isSafeInteger(reqOffset) ||
        reqOffset < 0
      ) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid pagination" }));
        return;
      }

      console.log(`[IGDB] search: "${q}" (limit: ${reqLimit}, offset: ${reqOffset})`);

      // ── Shared fields ──
      const FIELDS = `
            name, slug, first_release_date, summary,
            genres.name, platforms.name,
            involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
            cover.image_id, rating, rating_count, follows, total_rating_count, category,
            alternative_names.name`;

      // ── IGDB category classification ──
      // 0=main_game, 1=dlc, 2=expansion, 3=bundle, 4=standalone_expansion,
      // 5=mod, 6=episode, 7=season, 8=remake, 9=remaster, 10=expanded_game, 11=port, 12=fork
      // NOTE: IGDB does not reliably filter on category=0 in where clauses (classic games
      //       return cat=0 but the filter excludes them). We fetch without category filter
      //       and apply a score penalty on non-main categories after the fact.
      const NON_MAIN_CATEGORIES = new Set([1, 2, 3, 5, 6, 7, 12]); // DLC, expansions, bundles, mods, episodes, seasons, forks

      // ── Escape any quotes in the query ──
      const safeQ = JSON.stringify(q).slice(1, -1);

      // ── Phase 1 & 2: Parallel Prefix & Fuzzy Search ──
      // Prefix search catches "Tekken" when typing "te". Fuzzy search catches "Mortal Kombat" when typing "kombat".
      let searchFailures = 0;
      const [prefixRaw, fuzzyRaw] = await Promise.all([
        igdbFetch(
          "games",
          `
              where name ~ "${safeQ}"* | alternative_names.name ~ "${safeQ}"*;
              fields ${FIELDS};
              sort total_rating_count desc;
              limit ${reqLimit === 8 ? 40 : reqLimit};
              offset ${reqOffset};
            `
        ).catch((err) => {
          searchFailures++;
          console.error("[IGDB] Prefix search failed:", err);
          return [];
        }) as Promise<any[]>,
        igdbFetch(
          "games",
          `
              search "${safeQ}";
              fields ${FIELDS};
              limit ${reqLimit === 8 ? 40 : reqLimit};
              offset ${reqOffset};
            `
        ).catch((err) => {
          searchFailures++;
          console.error("[IGDB] Fuzzy search failed:", err);
          return [];
        }) as Promise<any[]>,
      ]);

      if (searchFailures === 2)
        throw new Error("Catalog search is unavailable. Check IGDB credentials and connectivity.");

      // ── Merge, de-dupe by id ──
      const seenIds = new Set<number>();
      const merged: any[] = [];
      for (const g of [...prefixRaw, ...fuzzyRaw]) {
        if (!seenIds.has(g.id)) {
          seenIds.add(g.id);
          merged.push(g);
        }
      }

      // ── Score: popularity + exact/prefix boost − non-main penalty ──
      const qLower = q.toLowerCase();
      const scored = merged.map((g) => {
        const pop = (g.total_rating_count || 0) + (g.follows || 0) * 0.5;
        const nameLower = (g.name || "").toLowerCase();
        const cat = g.category ?? 0; // 0 = main game (or unset, treated as main)

        // Exact match = big boost, word-boundary prefix = medium-high boost, simple prefix = medium boost
        let boost = 0;
        if (nameLower === qLower) boost = 500_000;
        else if (nameLower.startsWith(qLower + " ") || nameLower.startsWith(qLower + ":"))
          boost = 250_000;
        else if (nameLower.startsWith(qLower)) boost = 100_000;

        // Alternative name exact/prefix match
        const altMatch = (g.alternative_names || []).some((a: any) => {
          const alt = (a.name || "").toLowerCase();
          return alt === qLower || alt.startsWith(qLower);
        });
        if (altMatch && boost === 0) boost = 100_000;

        // Non-main category penalty (DLC, bundles, etc. pushed down)
        const penalty = NON_MAIN_CATEGORIES.has(cat) ? 0.1 : 1.0;

        return { ...g, _score: (pop + boost) * penalty, _cat: cat };
      });

      // Sort by score descending, take top N
      const sorted = scored.sort((a, b) => b._score - a._score).slice(0, reqLimit);

      // Log for debugging
      console.log(`[IGDB] results for "${q}":`);
      sorted.forEach((g, i) =>
        console.log(
          `  ${i + 1}. [cat:${g._cat}] ${g.name} (${g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : "?"}) pop=${g.total_rating_count ?? 0} score=${Math.round(g._score)}`
        )
      );

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(sorted));
    } catch (err: any) {
      console.error("[IGDB Error]", err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // ─── Basic fetch by ID (used by catalog.fetch) ───────────────────────
  app.use("/api/igdb/fetch", async (req: MinimalRequest, res: MinimalResponse) => {
    try {
      const id = new URLSearchParams(req.originalUrl?.split("?")[1] ?? "").get("id");
      if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid id" }));
        return;
      }

      console.log(`[IGDB] fetch: ${id}`);
      const raw = await igdbFetch(
        "games",
        `
            where id = ${id};
            fields name,slug,first_release_date,summary,genres.name,platforms.name,
                   involved_companies.company.name,involved_companies.developer,
                   involved_companies.publisher,cover.image_id,rating;
            limit 1;
          `
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(raw));
    } catch (err: any) {
      console.error("[IGDB Error]", err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // ─── Bulk fetch by IDs (used for data migrations) ───────────────────────
  app.use("/api/igdb/bulk-fetch", async (req: MinimalRequest, res: MinimalResponse) => {
    try {
      const ids = new URLSearchParams(req.originalUrl?.split("?")[1] ?? "").get("ids");
      if (!ids || !/^[1-9]\d*(,[1-9]\d*)*$/.test(ids) || ids.split(",").length > 500) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid ids" }));
        return;
      }

      console.log(`[IGDB] bulk-fetch: ${ids.split(",").length} games`);
      const raw = await igdbFetch(
        "games",
        `
            where id = (${ids});
            fields first_release_date;
            limit 500;
          `
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(raw));
    } catch (err: any) {
      console.error("[IGDB Error]", err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // ─── Full game detail (used by Game Detail screen) ───────────────────
  app.use("/api/igdb/detail", async (req: MinimalRequest, res: MinimalResponse) => {
    try {
      const id = new URLSearchParams(req.originalUrl?.split("?")[1] ?? "").get("id");
      if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid id" }));
        return;
      }

      console.log(`[IGDB] detail: ${id}`);

      // Fetch the main game with all detail fields
      const raw = (await igdbFetch(
        "games",
        `
            where id = ${id};
            fields
              name, slug, first_release_date, summary, storyline,
              rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count,
              genres.name, themes.name, keywords.name, game_engines.name, game_type,
              platforms.name, platforms.abbreviation,
              release_dates.human, release_dates.date, release_dates.region, release_dates.platform.name,
              involved_companies.company.name, involved_companies.developer, involved_companies.publisher, involved_companies.porting, involved_companies.supporting,
              cover.image_id, screenshots.image_id, artworks.image_id, videos.video_id, videos.name,
              language_supports.language.name, language_supports.language_support_type.name,
              game_modes.name, multiplayer_modes.*,
              player_perspectives.name,
              age_ratings.category, age_ratings.rating, age_ratings.content_descriptions.description, age_ratings.content_descriptions.category,
              alternative_names.name, alternative_names.comment, websites.url, websites.category,
              franchises.name, franchises.slug, franchises.games.name, franchises.games.cover.image_id, franchises.games.first_release_date, franchises.games.slug, franchises.games.total_rating_count, franchises.games.category, franchises.games.game_type.type,
              collections.name, collections.slug, collections.games.name, collections.games.cover.image_id, collections.games.first_release_date, collections.games.slug, collections.games.total_rating_count, collections.games.category, collections.games.game_type.type,
              game_localizations,
              similar_games.name, similar_games.cover.image_id, similar_games.first_release_date, similar_games.slug, similar_games.total_rating_count, similar_games.category, similar_games.game_type.type,
              dlcs.name, dlcs.cover.image_id, dlcs.first_release_date, dlcs.slug, dlcs.total_rating_count, dlcs.category, dlcs.game_type.type,
              expansions.name, expansions.cover.image_id, expansions.first_release_date, expansions.slug, expansions.total_rating_count, expansions.category, expansions.game_type.type,
              standalone_expansions.name, standalone_expansions.cover.image_id, standalone_expansions.first_release_date, standalone_expansions.slug, standalone_expansions.total_rating_count, standalone_expansions.category, standalone_expansions.game_type.type,
              ports.name, ports.cover.image_id, ports.first_release_date, ports.slug, ports.total_rating_count, ports.category, ports.game_type.type,
              remakes.name, remakes.cover.image_id, remakes.first_release_date, remakes.slug, remakes.total_rating_count, remakes.category, remakes.game_type.type,
              remasters.name, remasters.cover.image_id, remasters.first_release_date, remasters.slug, remasters.total_rating_count, remasters.category, remasters.game_type.type,
              bundles.name, bundles.cover.image_id, bundles.first_release_date, bundles.slug, bundles.total_rating_count, bundles.category, bundles.game_type.type,
              forks.name, forks.cover.image_id, forks.first_release_date, forks.slug, forks.total_rating_count, forks.category, forks.game_type.type;
            limit 1;
          `
      )) as any[];

      const game = raw[0] ?? null;

      // Fetch time_to_beat separately (it's a separate endpoint)
      let timeToBeat = null;
      try {
        const ttbRaw = (await igdbFetch(
          "game_time_to_beats",
          `
              where game_id = ${id};
              fields normally, hastily, completely;
              limit 1;
            `
        )) as any[];
        if (ttbRaw.length > 0) {
          const ttb = ttbRaw[0];
          timeToBeat = {
            average: ttb.hastily ? Math.round(ttb.hastily / 3600) : undefined,
            finish: ttb.normally ? Math.round(ttb.normally / 3600) : undefined,
            master: ttb.completely ? Math.round(ttb.completely / 3600) : undefined,
          };
        }
      } catch (e) {
        console.warn("Failed to fetch HLTB data", e);
        // time_to_beat is optional, ignore failures
      }

      // ─── Custom Related Games Query ─────────────────────────────────────
      if (game) {
        // Extract attributes for matching
        const genreIds = (game.genres || []).map((g: any) => g.id);
        const themeIds = (game.themes || []).map((t: any) => t.id);
        // Collect series IDs to exclude them from related
        const seriesIds = new Set<number>();
        (game.franchises || []).forEach((f: any) =>
          (f.games || []).forEach((g: any) => seriesIds.add(g.id))
        );
        (game.collections || []).forEach((c: any) =>
          (c.games || []).forEach((g: any) => seriesIds.add(g.id))
        );
        seriesIds.add(game.id); // Exclude the game itself

        if (genreIds.length > 0 || themeIds.length > 0) {
          const whereConds = [];
          // Require at least one matching genre (if the game has genres) to keep it relevant
          if (genreIds.length > 0) {
            whereConds.push(`genres = (${genreIds.join(",")})`);
          } else if (themeIds.length > 0) {
            whereConds.push(`themes = (${themeIds.join(",")})`);
          }

          // Exclude series games
          const excludeFilter =
            seriesIds.size > 0 ? `& id != (${Array.from(seriesIds).join(",")})` : "";
          const matchCondition = `${whereConds[0]} ${excludeFilter}`;

          try {
            const NON_MAIN_CATEGORIES = new Set([1, 2, 3, 5, 6, 7, 12]);
            const relatedRaw = (await igdbFetch(
              "games",
              `
                  where ${matchCondition};
                  fields name, slug, first_release_date, cover.image_id, total_rating_count, follows, category, game_type.type, genres, themes;
                  sort total_rating_count desc;
                  limit 100;
                `
            )) as any[];

            function jaccard(setA: Set<number>, setB: Set<number>) {
              if (setA.size === 0 && setB.size === 0) return 0;
              let intersection = 0;
              for (const x of setA) if (setB.has(x)) intersection++;
              const union = setA.size + setB.size - intersection;
              return intersection / union;
            }

            const gSet = new Set<number>(genreIds);
            const tSet = new Set<number>(themeIds);

            // Score by affinity (Jaccard) and popularity
            const scored = relatedRaw
              .filter((g) => !NON_MAIN_CATEGORIES.has(relatedCategory(g) ?? 0))
              .map((g) => {
                const pop = (g.total_rating_count || 0) + (g.follows || 0) * 0.5;

                const gJ = jaccard(gSet, new Set<number>(g.genres || []));
                const tJ = jaccard(tSet, new Set<number>(g.themes || []));

                // Genres matter most, themes second
                const affinity = gJ * 3 + tJ * 1;

                return { ...g, _affinity: affinity, _pop: pop };
              });

            // Top 24 related games, sorted by affinity first, popularity second
            game._custom_related = scored
              .sort((a, b) => b._affinity - a._affinity || b._pop - a._pop)
              .slice(0, 24);
          } catch (e: any) {
            console.error("[IGDB] Failed to fetch custom related games:", e.message);
          }
        }
      }

      const result = { game, timeToBeat };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (err: any) {
      console.error("[IGDB Error]", err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // ─── Batch Match Steam Games ───────────────────────────────────────────
  app.use("/api/igdb/match-steam", async (req: MinimalRequest, res: MinimalResponse) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const appIds: string[] = data.appIds || [];
        if (
          !Array.isArray(appIds) ||
          appIds.some((id) => typeof id !== "string" || !/^\d+$/.test(id))
        ) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid appIds" }));
          return;
        }
        if (appIds.length === 0) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({}));
          return;
        }

        console.log(`[IGDB] match-steam: ${appIds.length} games`);

        // IGDB allows a maximum limit of 500
        const batches = [];
        for (let i = 0; i < appIds.length; i += 500) {
          batches.push(appIds.slice(i, i + 500));
        }

        const matchMap: Record<string, any> = {};

        for (const batch of batches) {
          const uidList = batch.map((id) => `"${id}"`).join(",");
          const extGames = (await igdbFetch(
            "external_games",
            `
                where category = 1 & uid = (${uidList});
                fields game, uid;
                limit 500;
              `
          )) as { game: number; uid: string }[];

          if (extGames.length === 0) continue;

          const gameIds = extGames.map((eg) => eg.game).join(",");

          const rawGames = (await igdbFetch(
            "games",
            `
                where id = (${gameIds});
                fields name,slug,first_release_date,summary,genres.name,platforms.name,
                       involved_companies.company.name,involved_companies.developer,
                       involved_companies.publisher,cover.image_id,rating;
                limit 500;
              `
          )) as any[];

          const gamesById = new Map<number, any>();
          for (const g of rawGames) gamesById.set(g.id, g);

          for (const eg of extGames) {
            const igdbGame = gamesById.get(eg.game);
            if (igdbGame) {
              matchMap[eg.uid] = igdbGame;
            }
          }
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(matchMap));
      } catch (err: any) {
        console.error("[IGDB Match Error]", err.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  // ─── Platforms endpoint ────────────────────────────────────────────────
  app.use("/api/igdb/platforms", async (_req: MinimalRequest, res: MinimalResponse) => {
    try {
      const raw = (await igdbFetch(
        "platforms",
        `
              fields name, abbreviation, generation, platform_logo.image_id,
                versions.platform_version_release_dates.date, versions.platform_version_release_dates.y,
                versions.main_manufacturer.company.name, versions.companies.company.name, versions.companies.manufacturer;
              where name != null;
              limit 300;
              sort name asc;
            `
      )) as any[];

      const platforms = raw.map(normalizeSystemPlatform);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ platforms }));
    } catch (err: any) {
      console.error("[IGDB Platforms Error]", err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  let gameTypesRequest: Promise<{ id: number; type: string }[]> | undefined;
  const gameTypes = () =>
    (gameTypesRequest ??= igdbFetch("game_types", "fields type; limit 100;")
      .then((rows) => {
        if (!rows.length)
          throw new Error("Game classifications are unavailable. Please try again.");
        return rows as { id: number; type: string }[];
      })
      .catch((error) => {
        gameTypesRequest = undefined;
        throw error;
      }));

  // ─── Platform games directory endpoint ─────────────────────────────────
  app.use("/api/igdb/platform-games", async (req: MinimalRequest, res: MinimalResponse) => {
    try {
      const queryStr = req.originalUrl?.split("?")[1] ?? "";
      const params = new URLSearchParams(queryStr);
      if (req.method !== "GET" && req.method !== "POST") {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: "Use GET or POST." }));
        return;
      }
      const scope = params.get("library") ?? "all";
      if (scope !== "all" && req.method !== "POST")
        throw new CatalogQueryError("Library filters require the library ID list.");
      const ids = req.method === "POST" ? await readCatalogIds(req) : [];
      // Validate before any upstream calls, then resolve current type table IDs by name.
      buildSystemCatalogQuery(params, ids, []);
      const {
        platformId,
        limit,
        body: queryBody,
      } = buildSystemCatalogQuery(
        params,
        ids,
        params.get("type") === "all" || (!params.get("type") && params.get("includeAll") === "true")
          ? []
          : await gameTypes()
      );
      const rawGames = (await igdbFetch("games", queryBody)) as any[];

      const games = rawGames.map((g) => {
        let platformDate = g.first_release_date;
        if (g.release_dates && g.release_dates.length > 0) {
          const specificDates = g.release_dates
            .filter(
              (rd: any) => rd.platform === platformId && Number.isFinite(rd.date) && rd.date > 0
            )
            .map((rd: any) => rd.date as number);
          if (specificDates.length) platformDate = Math.min(...specificDates);
        }
        return {
          igdbId: g.id,
          title: g.name,
          slug: g.slug,
          releaseYear: platformDate ? new Date(platformDate * 1000).getUTCFullYear() : undefined,
          firstReleaseDate: platformDate,
          coverUrl: g.cover?.image_id
            ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
            : undefined,
          rating: g.total_rating ? Math.round(g.total_rating) : undefined,
          ratingCount: g.total_rating_count ?? 0,
          genres: g.genres?.map((x: any) => x.name) ?? [],
          category: relatedCategory(g),
        };
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ games, hasMore: games.length === limit }));
    } catch (err: any) {
      console.error("[IGDB Platform Games Error]", err.message);
      res.statusCode = err instanceof CatalogQueryError ? err.statusCode : 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

export function igdbBackend(): Plugin {
  return {
    name: "vite-plugin-igdb",
    configurePreviewServer(server) {
      attachIgdbRoutes(server.middlewares);
    },
    configureServer(server: ViteDevServer) {
      attachIgdbRoutes(server.middlewares);
    },
  };
}
