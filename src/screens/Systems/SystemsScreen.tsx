import { ProgressBar, ToggleButton } from "@fluentui/react-components";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader, EmptyState } from "../../components/ui/PageLayout";
import { Button } from "../../components/ui/Button";
import { TextInput, SelectControl } from "../../components/ui/Controls";
import { Skeleton } from "../../components/ui";
import { ChevronLeft, Filter, CheckSquare, Plus, Gamepad2 } from "../../components/icons";
import { CoverCard } from "../../components/CoverCard";
import { db } from "../../db/schema";
import { catalog, type CatalogGame } from "../../catalog";
import { SystemCatalogRepo } from "../../db/repositories/SystemCatalogRepo";
import { notify, notifyRemoval, operationError } from "../../services/feedback";
import {
  parseSystemCatalog,
  readSystemCatalogState,
  DEFAULT_SYSTEM_FILTERS,
  SYSTEM_GAME_TYPES,
  type SystemGameType,
  systemFilterError,
  type SystemCatalogGame,
  type SystemCatalogFilters,
} from "../../services/systemCatalog";
import type { Status, Log } from "../../types";
import { RelatedStrip } from "../GameDetail/RelatedStrip";
import "../GameDetail/GameDetail.css";
import { SystemPicker } from "./SystemPicker";
import "./SystemsScreen.css";
const IGDB_GENRES = [
  { id: 31, name: "Adventure" },
  { id: 12, name: "Role-playing (RPG)" },
  { id: 5, name: "Shooter" },
  { id: 8, name: "Platform" },
  { id: 32, name: "Indie" },
  { id: 15, name: "Strategy" },
  { id: 13, name: "Simulator" },
  { id: 14, name: "Sport" },
  { id: 10, name: "Racing" },
  { id: 4, name: "Fighting" },
  { id: 9, name: "Puzzle" },
  { id: 25, name: "Hack and slash/Beat 'em up" },
  { id: 34, name: "Visual Novel" },
  { id: 33, name: "Arcade" },
];

const SORT_OPTIONS = [
  { value: "popularity", label: "Most community ratings" },
  { value: "release_desc", label: "First release (newest)" },
  { value: "release_asc", label: "First release (oldest)" },
  { value: "rating", label: "Highest community score" },
  { value: "name", label: "Name (A–Z)" },
];

interface SystemsScreenProps {
  onOpenGame?: (id: number) => void;
  onOpenLog?: (id: number, prefill?: Partial<Log>, draft?: CatalogGame) => void;
}
export function SystemsScreen(props: SystemsScreenProps) {
  const { platformId } = useParams<{ platformId?: string }>();
  if (!platformId) return <SystemPicker />;
  const id = Number(platformId);
  if (!Number.isSafeInteger(id) || id < 1)
    return (
      <main id="main-content">
        <EmptyState
          title="System not found"
          description="Choose a system from the Systems page."
          actions={<Button onClick={() => window.history.back()}>Go back</Button>}
        />
      </main>
    );
  return <SystemDirectory key={id} platformId={id} {...props} />;
}
const initialFilters = DEFAULT_SYSTEM_FILTERS;
function SystemDirectory({
  platformId,
  onOpenGame,
  onOpenLog,
}: SystemsScreenProps & { platformId: number }) {
  const navigate = useNavigate(),
    [params] = useSearchParams();
  const suppliedName = params.get("name");
  const [resolvedName, setResolvedName] = useState(suppliedName ?? "System catalog");
  useEffect(() => {
    if (suppliedName) {
      setResolvedName(suppliedName);
      return;
    }
    const controller = new AbortController();
    fetch("/api/igdb/platforms", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const platform = data.platforms?.find((p: { id: number }) => p.id === platformId);
        if (platform?.name) setResolvedName(platform.name);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [suppliedName, platformId]);
  const library = useLiveQuery(() =>
    db.transaction("r", db.games, db.logs, async () => ({
      games: await db.games.toArray(),
      logs: await db.logs.toArray(),
    }))
  );
  const libraryIds = useMemo(() => new Set(library?.games.map((g) => g.igdbId) ?? []), [library]);
  const logMap = useMemo(
    () => new Map(library?.logs.map((log) => [log.igdbId, log]) ?? []),
    [library]
  );
  const preferenceKey = `gamelog.system-catalog.${platformId}.v1`;
  const [saved] = useState(() => {
    try {
      return readSystemCatalogState(sessionStorage.getItem(preferenceKey));
    } catch {
      return readSystemCatalogState(null);
    }
  });
  const [filters, setFilters] = useState(saved.filters),
    [debounced, setDebounced] = useState(saved.filters);
  const [view, setView] = useState<"grid" | "list">(saved.view);
  const libraryKey =
    (debounced.library ?? "all") === "all"
      ? ""
      : library
        ? [...libraryIds].sort((a, b) => a - b).join(",")
        : null;
  const membership = useMemo(
    () => (library ? new Map(library.logs.map((log) => [log.igdbId, log.status])) : undefined),
    [library]
  );
  useEffect(() => {
    try {
      if (!systemFilterError(filters))
        sessionStorage.setItem(preferenceKey, JSON.stringify({ filters, view }));
    } catch {
      /* Optional browsing preferences. */
    }
  }, [preferenceKey, filters, view]);
  const [showFilters, setShowFilters] = useState(false),
    [offset, setOffset] = useState(0),
    [attempt, setAttempt] = useState(0);
  const [games, setGames] = useState<SystemCatalogGame[]>([]),
    [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [selectMode, setSelectMode] = useState(false),
    [selected, setSelected] = useState<Set<number>>(new Set()),
    [bulkStatus, setBulkStatus] = useState<Status>("Backlog");
  const lastSelected = useRef<number | null>(null);
  const filterError = systemFilterError(filters);
  const pending = JSON.stringify(filters) !== JSON.stringify(debounced);
  const update = (change: Partial<SystemCatalogFilters>) =>
    setFilters((prev) => ({ ...prev, ...change }));
  useEffect(() => {
    setSelected(new Set());
    lastSelected.current = null;
    const timer = setTimeout(() => {
      if (!systemFilterError(filters)) {
        setDebounced(filters);
        setOffset(0);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [filters]);
  useEffect(() => {
    if (libraryKey === null) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    if (offset === 0) setGames([]);
    const query = new URLSearchParams({
      platformId: String(platformId),
      offset: String(offset),
      limit: "50",
      sort: debounced.sort,
      includeAll: String(debounced.type === "all"),
      type: debounced.type ?? "playable",
      library: debounced.library ?? "all",
    });
    for (const key of ["genre", "startYear", "endYear", "minRating", "q"] as const)
      if (debounced[key]) query.set(key, debounced[key]);
    fetch(`/api/igdb/platform-games?${query}`, {
      signal: controller.signal,
      ...(libraryKey
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: libraryKey.split(",").map(Number) }),
          }
        : (debounced.library ?? "all") !== "all"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: [] }),
            }
          : {}),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "The game catalog could not be loaded. Check your connection and try again."
          );
        return parseSystemCatalog(await response.json());
      })
      .then((data) => {
        if (active) {
          setGames((prev) =>
            offset === 0
              ? data.games
              : [...new Map([...prev, ...data.games].map((g) => [g.igdbId, g])).values()]
          );
          setHasMore(data.hasMore);
        }
      })
      .catch((err) => {
        if (active) setError(operationError(err, "Could not load games."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [platformId, offset, debounced, attempt, libraryKey]);
  const available = games.filter((g) => !libraryIds.has(g.igdbId));
  const selectedGames = available.filter((g) => selected.has(g.igdbId));
  const changing = loading || pending || !!filterError;
  const toggle = (game: SystemCatalogGame, event: React.MouseEvent) => {
    if (busy || changing || libraryIds.has(game.igdbId)) return;
    const index = games.findIndex((g) => g.igdbId === game.igdbId);
    const anchor = lastSelected.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (event.shiftKey && anchor !== null) {
        for (let i = Math.min(index, anchor); i <= Math.max(index, anchor); i++)
          if (!libraryIds.has(games[i]!.igdbId)) next.add(games[i]!.igdbId);
      } else if (next.has(game.igdbId)) next.delete(game.igdbId);
      else next.add(game.igdbId);
      return next;
    });
    lastSelected.current = index;
  };
  const metadata = async (game: SystemCatalogGame) => {
    const stored = await db.games.get(game.igdbId);
    if (stored) return stored;
    const full = await catalog.fetch(game.igdbId);
    if (!full) throw new Error(`Could not load ${game.title}. Please try again.`);
    return full;
  };
  const save = async (
    game: SystemCatalogGame,
    change: Partial<Pick<Log, "status" | "rating">>,
    openLog = false
  ) => {
    if (busy || changing) return;
    setBusy(true);
    setActionError(null);
    setProgress(`Saving ${game.title}…`);
    try {
      if (resolvedName === "System catalog")
        throw new Error("The system name is still loading. Please try again.");
      const full = await metadata(game);
      if (openLog) {
        onOpenLog?.(
          game.igdbId,
          libraryIds.has(game.igdbId) ? undefined : { platforms: [resolvedName] },
          full
        );
        return;
      }
      const id = await SystemCatalogRepo.save(full, resolvedName, change);
      if (id) notifyRemoval(`Added ${game.title}`, id);
      else notify(`Updated ${game.title}`, { intent: "success" });
    } catch (err) {
      setActionError(operationError(err, "Could not save this game."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const addSelected = async () => {
    if (busy || changing || !selectedGames.length) return;
    setBusy(true);
    setActionError(null);
    setProgress(`Preparing ${selectedGames.length} games…`);
    try {
      if (resolvedName === "System catalog")
        throw new Error("The system name is still loading. Please try again.");
      const full = [];
      for (const [index, game] of selectedGames.entries()) {
        setProgress(`Preparing game ${index + 1} of ${selectedGames.length}…`);
        full.push(await metadata(game));
      }
      const result = await SystemCatalogRepo.addSelected(full, resolvedName, bulkStatus);
      notifyRemoval(
        `Added ${result.count} ${result.count === 1 ? "game" : "games"}`,
        result.recoveryId
      );
      setSelected(new Set());
      setSelectMode(false);
    } catch (err) {
      setActionError(operationError(err, "Could not add the selected games."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const activeCount = [
    filters.genre,
    filters.startYear || filters.endYear,
    filters.minRating,
    filters.type !== "playable",
    filters.library !== "all",
  ].filter(Boolean).length;
  const reset = () => setFilters({ ...initialFilters, sort: filters.sort });
  return (
    <main id="main-content" className="system-directory">
      <PageHeader
        title={resolvedName}
        description="Explore games, or select several to add to your library."
        actions={
          <Button
            disabled={busy || changing || !library}
            aria-pressed={selectMode}
            onClick={() => {
              if (!selectMode) setView("grid");
              setSelectMode(!selectMode);
              setSelected(new Set());
              lastSelected.current = null;
            }}
          >
            <CheckSquare size={18} />
            {selectMode ? "Cancel selection" : "Select games"}
          </Button>
        }
        leading={
          <Button variant="ghost" onClick={() => navigate("/systems")} aria-label="Back to systems">
            <ChevronLeft size={20} />
          </Button>
        }
      />
      <div className="system-directory-content">
        <section
          className="system-catalog-tools systems-controls"
          aria-label="System catalog controls"
        >
          <div className="system-catalog-toolbar">
            <label className="system-catalog-search">
              Search this catalog
              <TextInput
                aria-label="Search games in this system"
                placeholder="Title words or number, e.g. fantasy 7 remake"
                maxLength={120}
                value={filters.q}
                disabled={busy}
                onChange={(e) => update({ q: e.target.value })}
              />
            </label>
            <Button
              disabled={busy}
              aria-expanded={showFilters}
              aria-controls="system-catalog-filters"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
            {(activeCount > 0 || filters.q) && (
              <Button disabled={busy} variant="ghost" onClick={reset}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="system-catalog-browse">
            <label>
              Game type
              <SelectControl
                aria-label="System game type"
                disabled={busy}
                value={filters.type ?? "playable"}
                onChange={(event) => update({ type: event.target.value as SystemGameType })}
              >
                {SYSTEM_GAME_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label>
              Genre
              <SelectControl
                aria-label="Catalog genre"
                disabled={busy}
                value={filters.genre}
                onChange={(e) => update({ genre: e.target.value })}
              >
                <option value="">All genres</option>
                {IGDB_GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label>
              Library
              <SelectControl
                aria-label="System library filter"
                disabled={busy || !library}
                value={filters.library ?? "all"}
                onChange={(event) =>
                  update({ library: event.target.value as "all" | "in" | "new" })
                }
              >
                <option value="all">All catalog games</option>
                <option value="in">In your library</option>
                <option value="new">Not in your library</option>
              </SelectControl>
            </label>
            <label>
              Sort by
              <SelectControl
                aria-label="Sort games"
                value={filters.sort}
                disabled={busy}
                onChange={(e) => update({ sort: e.target.value })}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectControl>
            </label>
          </div>
          <p className="system-catalog-help">
            Search and filters apply across this system’s full catalog, not just loaded games. Title
            words can be in any order; 7 also matches VII.
          </p>
          {showFilters && (
            <div id="system-catalog-filters" className="system-catalog-filters">
              <label>
                First release from
                <TextInput
                  type="number"
                  min={1900}
                  max={2100}
                  aria-label="First release from"
                  disabled={busy}
                  value={filters.startYear}
                  onChange={(e) => update({ startYear: e.target.value })}
                />
              </label>
              <label>
                First release to
                <TextInput
                  type="number"
                  min={1900}
                  max={2100}
                  aria-label="First release to"
                  disabled={busy}
                  value={filters.endYear}
                  onChange={(e) => update({ endYear: e.target.value })}
                />
              </label>
              <label>
                Community score (0–100)
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Minimum community score"
                  disabled={busy}
                  value={filters.minRating}
                  onChange={(e) => update({ minRating: e.target.value })}
                />
              </label>
            </div>
          )}
          {filterError && (
            <p className="system-catalog-error" role="alert">
              {filterError}
            </p>
          )}
          {!showFilters && activeCount > 0 && (
            <p className="system-catalog-help">
              Filters applied:{" "}
              {[
                filters.genre
                  ? IGDB_GENRES.find((g) => String(g.id) === filters.genre)?.name
                  : null,
                filters.startYear || filters.endYear
                  ? `First release ${filters.startYear || "any"}–${filters.endYear || "any"}`
                  : null,
                filters.minRating ? `Community score ≥ ${filters.minRating}` : null,
                filters.type !== "playable"
                  ? SYSTEM_GAME_TYPES.find((type) => type.value === filters.type)?.label
                  : null,
                filters.library === "in"
                  ? "In your library"
                  : filters.library === "new"
                    ? "Not in your library"
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </section>
        <div className="system-catalog-results-heading">
          <h2>Catalog games</h2>
          <div className="system-catalog-result-actions">
            <div role="group" aria-label="System result layout" className="system-catalog-layout">
              {(["grid", "list"] as const).map((mode) => (
                <ToggleButton
                  key={mode}
                  checked={view === mode}
                  disabled={busy || selectMode}
                  aria-label={mode === "grid" ? "Cover grid" : "Compact list"}
                  onClick={() => setView(mode)}
                >
                  {mode === "grid" ? "Covers" : "List"}
                </ToggleButton>
              ))}
            </div>
            <span role="status">
              {filterError
                ? "Check the filter values"
                : changing
                  ? "Updating catalog…"
                  : `${games.length} loaded · ${games.filter((g) => libraryIds.has(g.igdbId)).length} in your library`}
            </span>
          </div>
        </div>
        <p className="system-catalog-help">
          Years show release on this system. Year filters use the game’s first release. Opening a
          game does not add it to your library.
        </p>
        {actionError && (
          <div className="system-catalog-error" role="alert">
            {actionError}{" "}
            <Button size="sm" onClick={() => setActionError(null)}>
              Dismiss
            </Button>
          </div>
        )}
        {busy && (
          <div className="system-catalog-progress" role="status">
            <span>{progress}</span>
            <ProgressBar />
          </div>
        )}
        {selectMode && (
          <div className="system-catalog-selection">
            <Button
              disabled={busy || changing || !available.length}
              onClick={() =>
                setSelected(
                  selectedGames.length === available.length
                    ? new Set()
                    : new Set(available.map((g) => g.igdbId))
                )
              }
            >
              {selectedGames.length === available.length && available.length
                ? "Deselect all loaded"
                : "Select all loaded"}
            </Button>
            <span>
              {selectedGames.length} selected · Existing library games are excluded. Shift+click
              selects a range.
            </span>
          </div>
        )}
        {error && (
          <EmptyState
            alert
            title="Catalog could not be loaded"
            description={error}
            actions={<Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>}
          />
        )}
        {(loading && offset === 0) || (pending && !filterError) ? (
          <div className="system-catalog-grid" role="status" aria-label="Loading games">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} width="100%" height={240} />
            ))}
          </div>
        ) : games.length === 0 && !error ? (
          <EmptyState
            icon={<Gamepad2 size={24} />}
            title="No games match this selection"
            description="Try another title or clear the catalog filters."
            actions={<Button onClick={reset}>Clear filters</Button>}
          />
        ) : view === "list" && !selectMode ? (
          <RelatedStrip
            layout="list"
            library={membership}
            yearLabel="Release on system"
            listLabel="System catalog games"
            games={games.map((game) => ({
              id: game.igdbId,
              name: game.title,
              slug: game.slug ?? "",
              category: game.category,
              first_release_date: game.firstReleaseDate,
            }))}
            onGameClick={(id) => (onOpenGame ? onOpenGame(id) : navigate(`/game/${id}`))}
          />
        ) : (
          <div className="system-catalog-grid" aria-busy={loading || busy}>
            {games.map((game) => {
              const log = logMap.get(game.igdbId);
              return (
                <div
                  className="system-catalog-item"
                  key={game.igdbId}
                  inert={busy || changing ? true : undefined}
                >
                  <CoverCard
                    game={{
                      igdbId: game.igdbId,
                      title: game.title,
                      coverUrl: game.coverUrl,
                      releaseYear: game.releaseYear,
                      firstReleaseDate: game.firstReleaseDate,
                      status: log?.status,
                      completion: log?.completion,
                      rating: log?.rating,
                    }}
                    onClick={(id) => (onOpenGame ? onOpenGame(id) : navigate(`/game/${id}`))}
                    onChangeStatus={(_id, status) => {
                      void save(game, { status });
                    }}
                    onRate={(_id, rating) => {
                      void save(game, {
                        rating,
                        ...(!libraryIds.has(game.igdbId) ? { status: "Played" as Status } : {}),
                      });
                    }}
                    onLog={() => {
                      void save(game, {}, true);
                    }}
                    selectable={selectMode && !libraryIds.has(game.igdbId)}
                    selected={selected.has(game.igdbId)}
                    onToggleSelect={(_id, event) => toggle(game, event)}
                  />
                </div>
              );
            })}
          </div>
        )}
        {hasMore && !error && games.length > 0 && !pending && (
          <div className="system-catalog-load-more">
            <Button
              loading={loading}
              disabled={busy || !!filterError}
              onClick={() => setOffset((v) => v + 50)}
            >
              Load more games
            </Button>
          </div>
        )}
      </div>
      {selectMode && (
        <div className="system-catalog-bulk" aria-label="Add selected games">
          <strong role="status">{selectedGames.length} selected</strong>
          <label>
            Add to
            <SelectControl
              aria-label="Status for selected games"
              disabled={busy}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as Status)}
            >
              {["Backlog", "Playing", "Played", "Wishlist"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectControl>
          </label>
          <Button
            variant="primary"
            disabled={changing || !selectedGames.length}
            loading={busy}
            onClick={() => void addSelected()}
          >
            <Plus size={18} />
            {busy
              ? "Adding games…"
              : `Add ${selectedGames.length} ${selectedGames.length === 1 ? "game" : "games"}`}
          </Button>
        </div>
      )}
    </main>
  );
}
