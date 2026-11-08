const SavedViewsDialog = lazy(() =>
  import("../../components/features/SavedViewsDialog").then((module) => ({
    default: module.SavedViewsDialog,
  }))
);
const LibraryAssistantDialog = lazy(() =>
  import("../../components/features/LibraryAssistantDialog").then((module) => ({
    default: module.LibraryAssistantDialog,
  }))
);
import { PageHeader, EmptyState as SharedEmptyState } from "../../components/ui/PageLayout";
import { notify, operationError } from "../../services/feedback";
import { TextInput } from "../../components/ui/Controls";
import {
  readLibrarySort,
  readLibraryView,
  loggedPlatforms,
} from "../../services/libraryPresentation";
import { TabList, Tab, ToggleButton } from "@fluentui/react-components";
import { ActionMenu } from "../../components/ui/ActionMenu";
import { useState, useEffect, useRef, lazy } from "react";
import { DeferredDialog } from "../../components/ui/DeferredContent";
import {
  Search,
  ChevronDown,
  BookOpen,
  Plus,
  Grid2x2,
  List,
  Share2,
  X,
} from "../../components/icons";
import { useNavigate } from "react-router-dom";
import { CoverCard } from "../../components/CoverCard";
import { LibraryTableView } from "./LibraryTableView";
const ShareListModal = lazy(() =>
  import("../../components/features/ShareListModal").then((module) => ({
    default: module.ShareListModal,
  }))
);
import { useLibrary, useLibraryCounts, type SortKey } from "../../hooks/useLibrary";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import { LogsRepo } from "../../db/repositories";
import { FilterBar, ActiveFilterBadges } from "../../components/features/FilterBar";
import type { FilterSpec } from "../../services/filterEngine";
import { fetchDealsForWishlist } from "../../services/priceTracker";
import { SpotlightBanner } from "../../components/features/SpotlightBanner";
import { Button } from "../../components/ui/Button";
import type { Status } from "../../types";
import "./LibraryScreen.css";

// ─── Sort options ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "rating", label: "Rating" },
  { value: "title-asc", label: "Title (A-Z)" },
  { value: "title-desc", label: "Title (Z-A)" },
  { value: "year-desc", label: "Release year (newest first)" },
  { value: "year-asc", label: "Release year (oldest first)" },
  { value: "time", label: "Time played" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function LibraryScreen({
  onAddGame,
  onOpenLog,
  onOpenGame,
}: {
  onAddGame?: () => void;
  onOpenLog?: (igdbId: number) => void;
  onOpenGame?: (igdbId: number) => void;
}) {
  const savedViewsTrigger = useRef<HTMLButtonElement>(null);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const assistantTrigger = useRef<HTMLButtonElement>(null);
  const filterInput = useRef<HTMLInputElement>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [filterSpec, setFilterSpec] = useState<FilterSpec>({});
  const [sort, setSort] = useState<SortKey>(() => {
    try {
      return readLibrarySort(localStorage.getItem("gamelog.library-sort"));
    } catch {
      return "recent";
    }
  });
  const [shareOpen, setShareOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    try {
      return readLibraryView(localStorage.getItem("libraryViewMode"));
    } catch {
      return "grid";
    }
  });

  const handleViewModeChange = (mode: "grid" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("libraryViewMode", mode);
    } catch {
      /* The current view still works without storage. */
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("gamelog.library-sort", sort);
    } catch {
      /* Sorting still works without storage. */
    }
  }, [sort]);
  const facets = useLibrary({ sort: "recent" });
  const multiStatus = (filterSpec.status?.length ?? 0) > 1;
  const selectedStatus = multiStatus ? "custom" : (filterSpec.status?.[0] ?? "All");
  const setStatus = (status: string) =>
    setFilterSpec((previous) => ({
      ...previous,
      status:
        status === "All" ? undefined : status === "custom" ? previous.status : [status as Status],
    }));
  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const navigate = useNavigate();
  const entries = useLibrary({ filters: filterSpec, sort, search: debouncedSearch });
  const counts = useLibraryCounts();
  const { announce } = useLiveRegion();

  useEffect(() => {
    if (entries !== undefined) {
      announce(`Showing ${entries.length} ${entries.length === 1 ? "game" : "games"}`);
    }
  }, [entries?.length, announce]);

  useEffect(() => {
    if (
      filterSpec.status &&
      filterSpec.status.includes("Wishlist") &&
      entries &&
      entries.length > 0
    ) {
      const games = entries.map((e) => e.game);
      fetchDealsForWishlist(games);
    }
  }, [entries, filterSpec.status]);

  const hasActiveFilters = Object.entries(filterSpec).some(
    ([key, value]) =>
      key !== "platformSource" && value !== undefined && (!Array.isArray(value) || value.length > 0)
  );
  const resetFilters = () => {
    setFilterSpec({});
    setSearch("");
    setDebouncedSearch("");
    filterInput.current?.focus();
  };
  const totalCount = counts?.All ?? 0;
  const currentSort = SORT_OPTIONS.find((o) => o.value === sort)!;

  const handleStatusChange = async (igdbId: number, status: Status) => {
    try {
      await LogsRepo.updateStatus(igdbId, status);
    } catch (error) {
      notify("Status was not saved", {
        intent: "error",
        message: operationError(error, "Please try again. Your previous status was kept."),
      });
    }
  };

  const handleRate = async (igdbId: number, status: Status, rating: number) => {
    try {
      await LogsRepo.save(igdbId, { status, rating });
    } catch (error) {
      notify("Rating was not saved", {
        intent: "error",
        message: operationError(error, "Please try again. Your previous rating was kept."),
      });
    }
  };

  return (
    <main id="main-content" className="library-screen">
      {savedViewsOpen && (
        <DeferredDialog onClose={() => setSavedViewsOpen(false)} title="Saved views">
          <SavedViewsDialog
            restoreFocusRef={savedViewsTrigger}
            current={{ filters: filterSpec, search, sort, viewMode }}
            onClose={() => setSavedViewsOpen(false)}
            onApply={(view) => {
              setFilterSpec(view.filters);
              setSearch(view.search);
              setDebouncedSearch(view.search);
              setSort(view.sort);
              handleViewModeChange(view.viewMode);
            }}
          />
        </DeferredDialog>
      )}
      {assistantOpen && (
        <DeferredDialog onClose={() => setAssistantOpen(false)} title="Ask library">
          <LibraryAssistantDialog
            restoreFocusRef={assistantTrigger}
            mode="find"
            onClose={() => setAssistantOpen(false)}
            onApply={(criteria) => {
              setFilterSpec(criteria.filters);
              setSearch(criteria.titleQuery);
              setDebouncedSearch(criteria.titleQuery);
            }}
          />
        </DeferredDialog>
      )}
      {/* ── Toolbar ── */}
      <PageHeader
        title="Library"
        count={`${totalCount} ${totalCount === 1 ? "game" : "games"}`}
        actions={
          <div className="collection-tool-actions">
            <Button ref={savedViewsTrigger} onClick={() => setSavedViewsOpen(true)}>
              Saved views
            </Button>
            <Button ref={assistantTrigger} onClick={() => setAssistantOpen(true)}>
              Ask library
            </Button>
          </div>
        }
      />

      <div className="library-workspace">
        {
          <TabList
            className="library-status-nav"
            aria-label="Library status"
            selectedValue={selectedStatus}
            onTabSelect={(_event, data) => setStatus(String(data.value))}
          >
            {(["All", "Playing", "Backlog", "Played", "Wishlist"] as const).map((status) => (
              <Tab
                id={`library-status-${status}`}
                aria-controls="library-results"
                key={status}
                value={status}
              >
                {status === "All" ? "All games" : status}{" "}
                <span className="status-tab-count">{counts?.[status] ?? 0}</span>
              </Tab>
            ))}
            {multiStatus && (
              <Tab id="library-status-custom" aria-controls="library-results" value="custom">
                Custom status filter
              </Tab>
            )}
          </TabList>
        }
        <section aria-label="Library controls" className="library-controls">
          <div className="library-toolbar-row">
            <label className="library-search-field">
              <span>Search your library</span>
              <div>
                <TextInput
                  placeholder="Game title"
                  ref={filterInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Filter library"
                />
                {search && (
                  <Button
                    variant="ghost"
                    aria-label="Clear library search"
                    onClick={() => {
                      setSearch("");
                      setDebouncedSearch("");
                      filterInput.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            </label>
            <div className="library-toolbar-actions">
              <ActionMenu
                label="Sort games"
                trigger={
                  <Button aria-label={"Sort: " + currentSort.label}>
                    <ChevronDown size={16} />
                    Sort
                  </Button>
                }
                items={SORT_OPTIONS.map((option) => ({
                  key: option.value,
                  label: option.label,
                  checked: option.value === sort,
                  onClick: () => setSort(option.value),
                }))}
              />
              <FilterBar
                spec={filterSpec}
                onChange={setFilterSpec}
                genres={facets?.flatMap((entry) => entry.game.genres)}
                platforms={facets?.flatMap((entry) => [
                  ...entry.game.platforms,
                  ...loggedPlatforms(entry.log),
                ])}
              />
              <div className="library-display-mode" role="group" aria-label="Library view">
                {(["grid", "table"] as const).map((mode) => (
                  <ToggleButton
                    key={mode}
                    checked={viewMode === mode}
                    aria-label={mode === "grid" ? "Grid view" : "Table view"}
                    onClick={() => handleViewModeChange(mode)}
                    icon={mode === "grid" ? <Grid2x2 size={18} /> : <List size={18} />}
                  >
                    {mode === "grid" ? "Grid" : "Table"}
                  </ToggleButton>
                ))}
              </div>
              <Button
                aria-label="Share & Export Library"
                onClick={() => setShareOpen(true)}
                disabled={!entries?.length}
              >
                <Share2 size={18} />
                Share
              </Button>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="library-active-filters">
              <ActiveFilterBadges spec={filterSpec} onChange={setFilterSpec} />
            </div>
          )}
        </section>
        <div
          id="library-results"
          className="library-results"
          role={"tabpanel"}
          aria-labelledby={`library-status-${selectedStatus}`}
        >
          <div className="library-results-summary">
            <h2>
              {selectedStatus === "All"
                ? "Your games"
                : selectedStatus === "custom"
                  ? "Filtered games"
                  : selectedStatus}
            </h2>
            <span role="status">
              {entries === undefined
                ? "Loading games…"
                : `${entries.length} of ${totalCount} ${totalCount === 1 ? "game" : "games"}`}{" "}
              · {currentSort.label}
              {search !== debouncedSearch ? " · Updating search…" : ""}
            </span>
          </div>
          {/* ── Cover grid ── */}
          <div className="library-results-content">
            {!search.trim() && !hasActiveFilters && <SpotlightBanner />}

            <div>
              {/* Loading */}
              {entries === undefined && (
                <div className="flex-center" style={{ minHeight: 300 }}>
                  <span className="text-muted">Loading…</span>
                </div>
              )}

              {/* Empty state */}
              {entries !== undefined && entries.length === 0 && (
                <EmptyState
                  hasSearch={!!search.trim()}
                  hasFilter={hasActiveFilters}
                  filter={filterSpec.status?.[0] || "All"}
                  search={search}
                  onAddGame={onAddGame}
                  onClear={resetFilters}
                />
              )}

              {/* Grid or Table View */}
              {entries !== undefined &&
                entries.length > 0 &&
                (viewMode === "table" ? (
                  <LibraryTableView
                    entries={entries}
                    onOpenGame={
                      onOpenGame ? (id) => onOpenGame(id) : (id) => navigate(`/game/${id}`)
                    }
                    onOpenLog={onOpenLog}
                    sortKey={sort}
                    onSortChange={setSort}
                  />
                ) : (
                  <div className="library-game-grid">
                    {entries.map(({ game, log }) => (
                      <CoverCard
                        key={game.igdbId}
                        game={{
                          ...game,
                          status: log.status,
                          completion: log.completion,
                          rating: log.rating,
                          platform: loggedPlatforms(log).join(", ") || "Platform not recorded",
                          completionPercentage: log.completionPercentage,
                        }}
                        onClick={(id) => (onOpenGame ? onOpenGame(id) : navigate(`/game/${id}`))}
                        onChangeStatus={handleStatusChange}
                        onRate={(id, r) => handleRate(id, log.status, r)}
                        onLog={onOpenLog ? () => onOpenLog(game.igdbId) : undefined}
                      />
                    ))}
                  </div>
                ))}
            </div>

            {/* Share Modal */}
            {shareOpen && (
              <DeferredDialog onClose={() => setShareOpen(false)} title="Share and export">
                <ShareListModal
                  isOpen={shareOpen}
                  onClose={() => setShareOpen(false)}
                  title={
                    hasActiveFilters || search.trim() ? "Filtered game library" : "My Game Library"
                  }
                  entries={entries || []}
                />
              </DeferredDialog>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch,
  hasFilter,
  filter,
  search,
  onAddGame,
  onClear,
}: {
  hasSearch: boolean;
  hasFilter: boolean;
  filter: Status | "All";
  search: string;
  onAddGame?: () => void;
  onClear: () => void;
}) {
  const title = hasSearch
    ? `No results for "${search}"`
    : hasFilter
      ? filter === "All"
        ? "No games match these filters"
        : `Nothing in ${filter} yet`
      : "Your library is empty";

  const sub = hasSearch
    ? "Try a different title or clear your search."
    : hasFilter
      ? "Change your filters or clear them to return to all games."
      : "Start tracking your games by adding one.";

  return (
    <SharedEmptyState
      icon={hasSearch || hasFilter ? <Search size={24} /> : <BookOpen size={24} />}
      title={title}
      description={sub}
      actions={
        hasSearch || hasFilter ? (
          <Button onClick={onClear}>Clear search and filters</Button>
        ) : onAddGame ? (
          <Button variant="primary" onClick={onAddGame}>
            <Plus size={16} />
            Add game
          </Button>
        ) : undefined
      }
    />
  );
}
