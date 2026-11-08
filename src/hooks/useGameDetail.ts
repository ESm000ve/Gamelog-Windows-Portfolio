import { useState, useEffect } from "react";
import { db } from "../db/schema";
import { localGameDetail } from "../services/localGameDetail";
import { normalizeDetail, type GameDetail } from "../types/gameDetail";
const cache = new Map<number, GameDetail>();
interface DetailState {
  id: number | null;
  detail: GameDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  localFallback: boolean;
}
const empty = (id: number | null): DetailState => ({
  id,
  detail: cache.get(id ?? 0) ?? null,
  loading: id !== null && !cache.has(id),
  refreshing: false,
  error: id === null ? "Choose a valid game." : null,
  localFallback: false,
});
export function useGameDetail(igdbId: number | null) {
  const [state, setState] = useState(() => empty(igdbId)),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const initial = empty(igdbId);
    setState(initial);
    if (igdbId === null || initial.detail) return;
    void (async () => {
      let saved: GameDetail | null = null;
      try {
        const game = await db.games.get(igdbId);
        if (game) saved = localGameDetail(game);
      } catch {
        /* Online details can still load. */
      }
      if (!active) return;
      if (saved)
        setState({
          id: igdbId,
          detail: saved,
          loading: false,
          refreshing: true,
          error: null,
          localFallback: false,
        });
      timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/igdb/detail?id=" + igdbId, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Online game details could not be loaded. Please try again.");
        const data = await response.json();
        if (
          data.game?.id !== igdbId ||
          typeof data.game?.name !== "string" ||
          !data.game.name.trim()
        )
          throw new Error("This game could not be found in the catalog.");
        const detail = normalizeDetail(data.game, data.timeToBeat ?? null);
        if (active) {
          cache.set(igdbId, detail);
          setState({
            id: igdbId,
            detail,
            loading: false,
            refreshing: false,
            error: null,
            localFallback: false,
          });
        }
      } catch (error) {
        if (active)
          setState({
            id: igdbId,
            detail: saved,
            loading: false,
            refreshing: false,
            localFallback: !!saved,
            error: saved
              ? null
              : controller.signal.aborted
                ? "Online game details timed out. Please try again."
                : error instanceof Error
                  ? error.message
                  : "Could not load game details.",
          });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (timeout) clearTimeout(timeout);
    };
  }, [igdbId, attempt]);
  return {
    ...(state.id === igdbId ? state : empty(igdbId)),
    retry: () => {
      if (igdbId !== null) cache.delete(igdbId);
      setAttempt((value) => value + 1);
    },
  };
}
