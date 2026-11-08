import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { TabList, Tab, ToggleButton } from "@fluentui/react-components";
import { useGameDetail } from "../../hooks/useGameDetail";
import { useRelatedLibrary } from "../../hooks/useRelatedLibrary";
import { Button } from "../../components/ui/Button";
import { TextInput, SelectControl } from "../../components/ui/Controls";
import { PageHeader, EmptyState } from "../../components/ui/PageLayout";
import { ChevronLeft } from "../../components/icons";
import {
  RELATED_TABS,
  RELATED_LABELS,
  RELATED_DESCRIPTIONS,
  resolveRelatedTab,
} from "../../services/gameDetailPresentation";
import {
  readRelatedBrowse,
  browseRelated,
  readRelatedPosition,
  writeRelatedPosition,
  defaultSeriesGroup,
  resolveSeriesGroup,
  seriesGroupGames,
} from "../../services/relatedGames";
import { RelatedStrip } from "./RelatedStrip";
import "./GameDetail.css";
const POSITION_KEY = "gamelog.related-position.v1";
export function RelatedGamesPage({ onOpenGame }: { onOpenGame: (id: number) => void }) {
  const { igdbId: raw } = useParams<{ igdbId: string }>(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  const parsed = Number(raw),
    id = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  const { detail, loading, refreshing, error, localFallback, retry } = useGameDetail(id),
    library = useRelatedLibrary();
  const current = detail ? resolveRelatedTab(detail, params.get("tab")) : null;
  const available = detail ? RELATED_TABS.filter((tab) => detail.related[tab]?.length) : [];
  const state = readRelatedBrowse(params);
  const [query, setQuery] = useState(state.query);
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    // URL navigation may commit after the next keystroke. Never replace newer input
    // with an older navigation; external navigation still restores saved searches.
    if (pendingQuery.current === null || state.query === pendingQuery.current) {
      pendingQuery.current = null;
      setQuery(state.query);
    }
  }, [state.query]);
  const group = detail ? resolveSeriesGroup(detail, params.get("series_group")) : "all";
  const layout = params.get("view") === "list" ? "list" : "grid";
  const activeFilters =
    !!query ||
    state.scope !== "all" ||
    !!state.type ||
    (current === "series" && detail && group !== defaultSeriesGroup(detail));
  const games = useMemo(
    () =>
      detail && current
        ? current === "series"
          ? seriesGroupGames(detail, group)
          : detail.related[current]
        : [],
    [detail, current, group]
  );
  const results = useMemo(
    () => browseRelated(games, { ...state, query }, new Set(library?.keys() ?? [])),
    [games, query, state.sort, state.scope, state.type, library]
  );
  const [limit, setLimit] = useState(48),
    scroll = useRef<HTMLDivElement>(null),
    restored = useRef("");
  const key = JSON.stringify([
    id,
    current,
    query,
    state.sort,
    state.scope,
    state.type ?? "all",
    current === "series" ? group : "",
    layout,
  ]);
  const ready = !loading && !refreshing && !!detail && library !== undefined;
  const savePosition = () => {
    if (restored.current !== key || !scroll.current) return;
    try {
      sessionStorage.setItem(
        POSITION_KEY,
        writeRelatedPosition(
          sessionStorage.getItem(POSITION_KEY),
          key,
          scroll.current.scrollTop,
          limit
        )
      );
    } catch {
      /* Browsing works without preference storage. */
    }
  };
  useLayoutEffect(() => {
    if (!ready || !scroll.current || restored.current === key) return;
    let saved = { top: 0, limit: 48 };
    try {
      saved = readRelatedPosition(sessionStorage.getItem(POSITION_KEY), key);
    } catch {
      /* Start at the top. */
    }
    if (limit !== saved.limit) {
      setLimit(saved.limit);
      return;
    }
    scroll.current.scrollTop = saved.top;
    restored.current = key;
  }, [ready, key, limit]);
  useEffect(() => {
    savePosition();
  }, [limit]);
  useEffect(() => {
    if (detail && !refreshing && current && params.get("tab") !== current)
      setParams(
        (previous) => {
          previous.set("tab", current);
          return previous;
        },
        { replace: true }
      );
  }, [detail?.igdbId, refreshing, current, params, setParams]);
  const update = (change: Record<string, string>, replace = true) =>
    setParams(
      (previous) => {
        for (const [name, value] of Object.entries(change))
          if (
            value &&
            !(name === "library" && value === "all") &&
            !(name === "type" && value === "all") &&
            !(name === "sort" && value === "catalog")
          )
            previous.set(name, value);
          else previous.delete(name);
        return previous;
      },
      { replace }
    );
  const clear = () => {
    pendingQuery.current = "";
    setQuery("");
    update({ q: "", library: "all", type: "all", series_group: "" });
  };
  return (
    <main id="main-content" className="game-detail-screen">
      <PageHeader
        title="Related games"
        description={detail ? `For ${detail.title}` : undefined}
        leading={
          <Button
            variant="ghost"
            aria-label="Back to game"
            onClick={() => navigate(id ? `/game/${id}` : "/")}
          >
            <ChevronLeft size={20} />
          </Button>
        }
      />
      <div
        className="game-detail-content related-browser-content"
        ref={scroll}
        onScroll={savePosition}
      >
        {id === null ? (
          <EmptyState
            title="Choose a valid game"
            description="Select a game in your library to browse related titles."
            actions={<Button onClick={() => navigate("/")}>Go to library</Button>}
          />
        ) : loading && !detail ? (
          <p role="status">Loading related games…</p>
        ) : !detail || error ? (
          <EmptyState
            alert
            title="Related games are unavailable"
            description={error ?? "This game could not be found."}
            actions={<Button onClick={retry}>Retry</Button>}
          />
        ) : (
          <>
            {localFallback && (
              <div className="detail-notice" role="status">
                Online related games are unavailable.
                <Button onClick={retry}>Retry online details</Button>
              </div>
            )}
            {refreshing && (
              <p role="status" className="detail-help">
                Loading online related games…
              </p>
            )}
            {current ? (
              <>
                {
                  <TabList
                    className="related-category-tabs"
                    aria-label="Related game categories"
                    selectedValue={current}
                    onTabSelect={(_event, data) => update({ tab: String(data.value) }, false)}
                  >
                    {available.map((tab) => (
                      <Tab
                        key={tab}
                        value={tab}
                        id={`related-page-${tab}`}
                        aria-controls="related-page-results"
                      >
                        {RELATED_LABELS[tab]} ({detail.related[tab].length})
                      </Tab>
                    ))}
                  </TabList>
                }
                <p className="detail-help">
                  {current === "series" && group !== "all"
                    ? "Showing the selected series group. Choose all series and franchise entries to explore the wider catalog."
                    : RELATED_DESCRIPTIONS[current]}
                </p>
                <section aria-label="Related browsing controls" className="related-browse-controls">
                  <label className="related-search">
                    Find a game
                    <TextInput
                      aria-label="Search related games"
                      placeholder="Title words or number, e.g. 7 remake"
                      value={query}
                      onChange={(event) => {
                        const value = event.target.value;
                        pendingQuery.current = value;
                        setQuery(value);
                        update({ q: value });
                      }}
                    />
                  </label>
                  {current === "series" && !!detail.seriesGroups?.length && (
                    <label>
                      Series group
                      <SelectControl
                        aria-label="Series group"
                        value={group}
                        onChange={(event) => update({ series_group: event.target.value })}
                      >
                        {defaultSeriesGroup(detail) === "collections" && (
                          <option value="collections">Named series only</option>
                        )}
                        {detail.seriesGroups
                          .filter((item) => item.kind === "collection")
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        <option value="all">All series and franchise entries</option>
                        {detail.seriesGroups
                          .filter((item) => item.kind === "franchise")
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} (franchise)
                            </option>
                          ))}
                      </SelectControl>
                    </label>
                  )}
                  <label>
                    Game type
                    <SelectControl
                      aria-label="Related game type"
                      value={state.type ?? "all"}
                      onChange={(event) => update({ type: event.target.value })}
                    >
                      <option value="all">All types</option>
                      <option value="games">Full games &amp; standalone expansions</option>
                      <option value="versions">Remakes, remasters &amp; ports</option>
                      <option value="addons">DLC &amp; expansions</option>
                      <option value="bundles">Bundles</option>
                      <option value="other">Other types</option>
                      <option value="unknown">Not classified</option>
                    </SelectControl>
                  </label>
                  <label>
                    Library
                    <SelectControl
                      aria-label="Related library filter"
                      value={state.scope}
                      onChange={(event) => update({ library: event.target.value })}
                    >
                      <option value="all">All listed games</option>
                      <option value="in">In your library</option>
                      <option value="new">Not in your library</option>
                    </SelectControl>
                  </label>
                  <label>
                    Sort by
                    <SelectControl
                      aria-label="Sort related games"
                      value={state.sort}
                      onChange={(event) => update({ sort: event.target.value })}
                    >
                      <option value="catalog">Catalog order</option>
                      <option value="name">Name (A–Z)</option>
                      <option value="newest">First release (newest)</option>
                      <option value="oldest">First release (oldest)</option>
                    </SelectControl>
                  </label>
                  <div
                    className="related-layout-toggle"
                    role="group"
                    aria-label="Related result layout"
                  >
                    {(["list", "grid"] as const).map((mode) => (
                      <ToggleButton
                        key={mode}
                        checked={layout === mode}
                        aria-label={mode === "list" ? "Compact list" : "Cover grid"}
                        onClick={() => update({ view: mode })}
                      >
                        {mode === "list" ? "List" : "Covers"}
                      </ToggleButton>
                    ))}
                  </div>
                  {activeFilters && <Button onClick={clear}>Clear filters</Button>}
                </section>
                <div
                  id="related-page-results"
                  role={"tabpanel"}
                  aria-labelledby={`related-page-${current}`}
                  className="related-results"
                >
                  <p className="detail-help" role="status">
                    {state.scope !== "all" && !library
                      ? "Checking your library…"
                      : `Showing ${Math.min(limit, results.length)} of ${results.length} ${results.length === 1 ? "game" : "games"}${activeFilters ? ` · ${games.length} listed in this category` : ""}${current === "series" && games.length < detail.related.series.length ? ` · ${detail.related.series.length} across all series and franchise entries` : ""}`}
                  </p>
                  {state.scope !== "all" && !library ? (
                    <p>Loading library information…</p>
                  ) : results.length ? (
                    <>
                      <RelatedStrip
                        games={results.slice(0, limit)}
                        layout={layout}
                        library={library}
                        onGameClick={onOpenGame}
                      />
                      {results.length > limit && (
                        <Button onClick={() => setLimit((previous) => previous + 48)}>
                          Show more games ({results.length - limit} remaining)
                        </Button>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      title="No games match these filters"
                      description="Try another title or show all listed games."
                      actions={<Button onClick={clear}>Clear filters</Button>}
                    />
                  )}
                </div>
              </>
            ) : (
              !refreshing && (
                <EmptyState
                  title={
                    localFallback ? "Related games need online details" : "No related games listed"
                  }
                  description={
                    localFallback
                      ? "Your saved game is still available. Retry when you have a connection."
                      : "The catalog has no related entries for this title."
                  }
                />
              )
            )}
          </>
        )}
      </div>
    </main>
  );
}
