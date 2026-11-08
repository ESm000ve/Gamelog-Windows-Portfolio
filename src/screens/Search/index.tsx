import { notifyRemoval, notify, operationError } from "../../services/feedback";
import { SelectControl } from "../../components/ui/Controls";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { catalog, type CatalogGame } from "../../catalog";
import { db } from "../../db/schema";
import { useLiveQuery } from "dexie-react-hooks";
import { GamesRepo, LogsRepo } from "../../db/repositories";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import type { Status, Log } from "../../types";
import { Button } from "../../components/ui/Button";
import { SearchToolbar } from "./SearchToolbar";
import { SearchResultsGrid } from "./SearchResultsGrid";

export function SearchScreen({
  onOpenGame,
  onOpenLog,
}: {
  onOpenGame?: (id: number) => void;
  onOpenLog?: (id: number, prefill?: Partial<Log>, draft?: CatalogGame) => void;
}) {
  const [bulkAdding, setBulkAdding] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  // The committed URL query is the source of truth for results and history.
  const debouncedQuery = initialQ;

  const [results, setResults] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkStatus, setBulkStatus] = useState<Status>("Backlog");

  const navigate = useNavigate();
  const { announce } = useLiveRegion();
  const limit = 50;

  const libraryLogs = useLiveQuery(() => db.logs.toArray());
  const libraryMap = useMemo(
    () => new Map((libraryLogs ?? []).map((log) => [log.igdbId, log.status])),
    [libraryLogs]
  );
  const completionMap = useMemo(
    () => new Map((libraryLogs ?? []).map((log) => [log.igdbId, log.completion])),
    [libraryLogs]
  );

  useEffect(() => {
    setQuery(initialQ);
  }, [initialQ]);

  useEffect(() => {
    if (query === initialQ) return;
    // Only typed edits are debounced. A new global search or Back/Forward
    // updates results immediately and cancels this pending local edit.
    const timer = setTimeout(() => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (query) next.set("q", query);
          else next.delete("q");
          return next;
        },
        { replace: true }
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [query, initialQ, setSearchParams]);

  useEffect(() => {
    setOffset(0);
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
    setResults([]);
    setHasMore(true);
  }, [debouncedQuery]);

  useEffect(() => {
    let mounted = true;
    if (!debouncedQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    async function fetchResults() {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const games = await catalog.searchAll(debouncedQuery, limit, offset);
        if (!mounted) return;

        setResults((prev) => (offset === 0 ? games : [...prev, ...games]));
        setHasMore(games.length >= limit);
        if (offset === 0) announce(`Found ${games.length} games matching ${debouncedQuery}`);
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setError("Failed to fetch results.");
        announce("Failed to search", "assertive");
      } finally {
        if (mounted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }
    fetchResults();
    return () => {
      mounted = false;
    };
  }, [debouncedQuery, offset]);

  // Infinite scroll logic using IntersectionObserver on a sentinel element
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && debouncedQuery) {
          setOffset((prev) => prev + limit);
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, debouncedQuery]);

  const handleStatusChange = async (game: CatalogGame, status: Status) => {
    if (!libraryMap.has(game.igdbId)) {
      await GamesRepo.addFromCatalog(game, status);
    } else {
      await LogsRepo.updateStatus(game.igdbId, status);
    }
  };

  const handleRate = async (game: CatalogGame, rating: number) => {
    if (!libraryMap.has(game.igdbId)) {
      await GamesRepo.addFromCatalog(game, "Played");
      await LogsRepo.save(game.igdbId, { status: "Played", rating });
    } else {
      const status = libraryMap.get(game.igdbId)!;
      await LogsRepo.save(game.igdbId, { status, rating });
    }
  };

  const handleLog = (game: CatalogGame) => {
    onOpenLog?.(game.igdbId, undefined, game);
  };

  const handleToggleSelect = (game: CatalogGame, e: React.MouseEvent) => {
    if (libraryMap.has(game.igdbId)) return;
    const index = results.findIndex((r) => r.igdbId === game.igdbId);
    if (index === -1) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(index, lastSelectedIndex);
        const end = Math.max(index, lastSelectedIndex);
        for (let i = start; i <= end; i++) {
          const g = results[i];
          if (!libraryMap.has(g.igdbId)) {
            next.add(g.igdbId);
          }
        }
      } else {
        if (next.has(game.igdbId)) {
          next.delete(game.igdbId);
        } else {
          next.add(game.igdbId);
        }
      }
      return next;
    });
    setLastSelectedIndex(index);
  };

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        minWidth: 0,
      }}
    >
      <SearchToolbar
        query={query}
        onQueryChange={setQuery}
        onBack={() => navigate("/")}
        selectMode={selectMode}
        onToggleSelectMode={() => {
          if (selectMode) {
            setSelectMode(false);
            setSelectedIds(new Set());
            setLastSelectedIndex(null);
          } else {
            setSelectMode(true);
          }
        }}
        selectedCount={selectedIds.size}
        totalSelectable={results.filter((g) => !libraryMap.has(g.igdbId)).length}
        onToggleSelectAll={() => {
          const selectableIds = results
            .filter((g) => !libraryMap.has(g.igdbId))
            .map((g) => g.igdbId);
          if (selectedIds.size === selectableIds.length && selectableIds.length > 0) {
            setSelectedIds(new Set());
          } else {
            setSelectedIds(new Set(selectableIds));
          }
        }}
      />

      <SearchResultsGrid
        results={results}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        offset={offset}
        debouncedQuery={debouncedQuery}
        hasMore={hasMore}
        libraryMap={libraryMap}
        completionMap={completionMap}
        selectMode={selectMode}
        selectedIds={selectedIds}
        observerTarget={observerTarget}
        onOpenGame={onOpenGame}
        onStatusChange={handleStatusChange}
        onRate={handleRate}
        onLog={handleLog}
        onToggleSelect={handleToggleSelect}
      />

      {/* ── Bulk Action Bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--app-tertiary-bg)",
            border: "1px solid var(--app-separator)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-3) var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            zIndex: 50,
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 500,
              color: "var(--app-label)",
            }}
          >
            {selectedIds.size} selected
          </span>
          <div style={{ width: 1, height: 24, background: "var(--app-separator)" }} />
          <SelectControl
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as Status)}
            style={{
              padding: "6px var(--space-3)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--app-separator)",
              background: "var(--app-fill)",
              color: "var(--app-label)",
              fontSize: "var(--font-size-base)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="Wishlist">Wishlist</option>
            <option value="Backlog">Backlog</option>
            <option value="Playing">Playing</option>
            <option value="Played">Played</option>
          </SelectControl>
          <Button
            variant="primary"
            size="sm"
            loading={bulkAdding}
            onClick={async () => {
              if (bulkAdding) return;
              setBulkAdding(true);
              try {
                const gamesToImport = results
                  .filter((g) => selectedIds.has(g.igdbId))
                  .map((g) => ({
                    ...g,
                    addedAt: Date.now(),
                    updatedAt: Date.now(),
                  }));
                const logsToImport = gamesToImport.map((g) => ({
                  igdbId: g.igdbId,
                  status: bulkStatus,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }));
                const recoveryId = await GamesRepo.bulkImport(
                  gamesToImport as any,
                  logsToImport as any,
                  false
                );
                notifyRemoval(`Added ${gamesToImport.length} games`, recoveryId);

                announce(`Added ${selectedIds.size} games to ${bulkStatus}`);
                setSelectMode(false);
                setSelectedIds(new Set());
                setLastSelectedIndex(null);
              } catch (error) {
                notify("Could not add selected games", {
                  intent: "error",
                  message: operationError(error, "Please try again. Your selection was kept."),
                });
              } finally {
                setBulkAdding(false);
              }
            }}
          >
            Add {selectedIds.size} games
          </Button>
        </div>
      )}
    </main>
  );
}
