import { db } from "../db/schema";
import type { Game } from "../types";

// Simple in-memory cache to avoid redundant API calls during the session
const pendingDeals = new Map<number, Promise<void>>();
const dealCache = new Map<number, { price: number; url: string } | null>();

/**
 * Fetches the current cheapest deals for a list of games from CheapShark.
 * Updates the local database with the deal price and redirect URL.
 */
export async function fetchDealsForWishlist(games: Game[]): Promise<void> {
  await Promise.all(
    games.map((game) => {
      if (dealCache.has(game.igdbId)) return Promise.resolve();
      const pending = pendingDeals.get(game.igdbId);
      if (pending) return pending;
      const task = (async () => {
        try {
          const res = await fetch(
            `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(game.title)}&limit=3`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (!res.ok) return;
          const data: unknown = await res.json();
          const key = (value: string) =>
            value
              .trim()
              .toLowerCase()
              .replace(/[^\p{L}\p{N}]/gu, "");
          const deal = Array.isArray(data)
            ? data.find(
                (item) =>
                  item &&
                  typeof item.external === "string" &&
                  key(item.external) === key(game.title)
              )
            : undefined;
          if (
            !deal ||
            typeof deal.cheapest !== "string" ||
            !deal.cheapest.trim() ||
            typeof deal.cheapestDealID !== "string" ||
            !deal.cheapestDealID
          )
            return;
          const price = Number(deal.cheapest);
          if (!Number.isFinite(price) || price < 0) return;
          const url = `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.cheapestDealID)}`;
          await db.games.update(game.igdbId, { dealPrice: price, dealUrl: url });
          dealCache.set(game.igdbId, { price, url });
        } catch (error) {
          console.warn(`Could not check deals for ${game.title}`, error);
        } finally {
          if (!dealCache.has(game.igdbId)) dealCache.set(game.igdbId, null);
        }
      })().finally(() => {
        pendingDeals.delete(game.igdbId);
      });
      pendingDeals.set(game.igdbId, task);
      return task;
    })
  );
}
