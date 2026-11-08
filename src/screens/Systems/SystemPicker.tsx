import { PageHeader, EmptyState } from "../../components/ui/PageLayout";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Tab,
  TabList,
} from "@fluentui/react-components";
import { db } from "../../db/schema";
import { Button } from "../../components/ui/Button";
import { TextInput, SelectControl } from "../../components/ui/Controls";
import { Gamepad2, ChevronRight, X } from "../../components/icons";
import {
  getLibrarySystemCounts,
  getSystemEra,
  parseSystemBrowserState,
  sortSystems,
  DEFAULT_SYSTEM_BROWSER,
  type SystemPlatform,
  type SystemBrowserState,
  type SystemCounts,
} from "../../services/systemBrowser";
import "./SystemPicker.css";

const STORAGE_KEY = "gamelog.system-browser.v1";
let pendingPlatforms: Promise<SystemPlatform[]> | undefined;
function loadPlatforms(refresh = false) {
  if (refresh) pendingPlatforms = undefined;
  return (pendingPlatforms ??= fetch("/api/igdb/platforms")
    .then(async (response) => {
      if (!response.ok)
        throw new Error(
          "The system catalog could not be loaded. Check your connection and try again."
        );
      const data = await response.json();
      if (!Array.isArray(data.platforms))
        throw new Error("The system catalog returned an invalid response.");
      return data.platforms as SystemPlatform[];
    })
    .catch((error) => {
      pendingPlatforms = undefined;
      throw error;
    }));
}
function readState() {
  try {
    return parseSystemBrowserState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SYSTEM_BROWSER };
  }
}
function saveState(state: SystemBrowserState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Browsing still works when preference storage is unavailable. */
  }
}

export function SystemPicker() {
  const navigate = useNavigate();
  const [initial] = useState(readState);
  const [preferences, setPreferences] = useState(initial);
  const latest = useRef(preferences);
  latest.current = preferences;
  const scrollTop = useRef(initial.scrollTop);
  const restored = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | undefined>(undefined);
  const [platforms, setPlatforms] = useState<SystemPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const library = useLiveQuery(() =>
    db.transaction("r", db.games, db.logs, async () => ({
      games: await db.games.toArray(),
      logs: await db.logs.toArray(),
    }))
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadPlatforms(attempt > 0)
      .then((data) => {
        if (active)
          setPlatforms(
            data.map((platform) => ({
              ...platform,
              manufacturers: (platform.manufacturers ?? []).filter(
                (name) => typeof name === "string" && /\p{L}/u.test(name)
              ),
            }))
          );
      })
      .catch((error) => {
        if (active) setError(error instanceof Error ? error.message : "Could not load systems.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const ready = !loading && library !== undefined;
  useLayoutEffect(() => {
    if (ready && !restored.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollTop.current;
      restored.current = true;
    }
  }, [ready]);
  useEffect(() => {
    saveState({ ...preferences, scrollTop: scrollTop.current });
  }, [preferences]);
  useEffect(
    () => () => {
      if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
      saveState({ ...latest.current, scrollTop: scrollTop.current });
    },
    []
  );
  const update = (change: Partial<SystemBrowserState>) => {
    scrollTop.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setPreferences((previous) => ({ ...previous, ...change }));
  };
  const { counts, unassigned } = useMemo(
    () => getLibrarySystemCounts(platforms, library?.games ?? [], library?.logs ?? []),
    [platforms, library]
  );
  const yours = platforms.filter((platform) => counts.has(platform.id));
  const manufacturers = useMemo(
    () =>
      [...new Set(platforms.flatMap((platform) => platform.manufacturers ?? []))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [platforms]
  );
  const visible = useMemo(() => {
    const query = preferences.query.toLowerCase().trim();
    return sortSystems(
      platforms.filter(
        (platform) =>
          (preferences.view === "all" || counts.has(platform.id)) &&
          (preferences.manufacturer === "all" ||
            (preferences.manufacturer === "unlisted"
              ? !platform.manufacturers?.length
              : (platform.manufacturers ?? []).includes(preferences.manufacturer))) &&
          (!query ||
            `${platform.name} ${platform.abbreviation ?? ""}`.toLowerCase().includes(query))
      ),
      preferences.sort,
      counts
    );
  }, [
    platforms,
    counts,
    preferences.query,
    preferences.manufacturer,
    preferences.sort,
    preferences.view,
  ]);
  const groups = useMemo(() => {
    const result = new Map<string, SystemPlatform[]>();
    visible.forEach((platform) => {
      const label =
        preferences.group === "era"
          ? getSystemEra(platform)
          : preferences.group === "manufacturer"
            ? preferences.manufacturer !== "all"
              ? preferences.manufacturer === "unlisted"
                ? "Manufacturer not listed"
                : preferences.manufacturer
              : (platform.manufacturers?.[0] ?? "Manufacturer not listed")
            : "All systems";
      result.set(label, [...(result.get(label) ?? []), platform]);
    });
    return [...result].sort(([a], [b]) => {
      const aYear = preferences.group === "era" ? parseInt(a) : NaN,
        bYear = preferences.group === "era" ? parseInt(b) : NaN;
      if (Number.isFinite(aYear) && Number.isFinite(bYear))
        return preferences.sort === "oldest" ? aYear - bYear : bYear - aYear;
      if (Number.isFinite(aYear)) return -1;
      if (Number.isFinite(bYear)) return 1;
      return a.localeCompare(b);
    });
  }, [visible, preferences.group, preferences.sort, preferences.manufacturer]);
  const filtered = Boolean(preferences.query || preferences.manufacturer !== "all");
  const openSystem = (platform: SystemPlatform) =>
    navigate(`/systems/${platform.id}?name=${encodeURIComponent(platform.name)}`);
  const cards = (items: SystemPlatform[]) => (
    <div className="system-browser-grid">
      {items.map((platform) => (
        <SystemCard
          key={platform.id}
          platform={platform}
          counts={counts.get(platform.id)}
          onOpen={() => openSystem(platform)}
        />
      ))}
    </div>
  );
  return (
    <main id="main-content" className="system-browser">
      <PageHeader
        title="Systems"
        description="Browse platforms or return to the systems in your library."
      />
      <div
        className="system-browser-body"
        ref={scrollRef}
        onScroll={(event) => {
          if (!restored.current) return;
          scrollTop.current = event.currentTarget.scrollTop;
          if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
          scrollFrame.current = requestAnimationFrame(() =>
            saveState({ ...latest.current, scrollTop: scrollTop.current })
          );
        }}
      >
        <section
          className="system-browser-header systems-controls"
          aria-label="System browsing controls"
        >
          {
            <TabList
              aria-label="System collections"
              selectedValue={preferences.view}
              onTabSelect={(_event, data) =>
                update({ view: data.value as SystemBrowserState["view"] })
              }
            >
              <Tab value="yours" id="system-view-yours" aria-controls="system-results">
                Your systems{" "}
                <span className="system-browser-count">{ready ? `(${yours.length})` : ""}</span>
              </Tab>
              <Tab value="all" id="system-view-all" aria-controls="system-results">
                Browse all{" "}
                <span className="system-browser-count">{ready ? `(${platforms.length})` : ""}</span>
              </Tab>
            </TabList>
          }
          <div className="system-browser-toolbar">
            <label className="system-browser-search">
              <span>Filter systems</span>
              <div>
                <TextInput
                  aria-label="Filter systems"
                  placeholder="Name or abbreviation"
                  value={preferences.query}
                  onChange={(event) => update({ query: event.target.value })}
                  style={{
                    width: "100%",
                  }}
                />
                {preferences.query && (
                  <Button
                    variant="ghost"
                    aria-label="Clear system search"
                    onClick={() => update({ query: "" })}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            </label>
            <label>
              <span>Manufacturer</span>
              <SelectControl
                aria-label="Manufacturer"
                value={preferences.manufacturer}
                onChange={(event) => update({ manufacturer: event.target.value })}
              >
                <option value="all">All manufacturers</option>
                <option value="unlisted">Manufacturer not listed</option>
                {manufacturers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label>
              <span>Sort by</span>
              <SelectControl
                aria-label="Sort systems"
                value={preferences.sort}
                onChange={(event) =>
                  update({ sort: event.target.value as SystemBrowserState["sort"] })
                }
              >
                <option value="name">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="newest">Release year (newest)</option>
                <option value="oldest">Release year (oldest)</option>
                <option value="library">Most games in library</option>
              </SelectControl>
            </label>
            <label>
              <span>Group by</span>
              <SelectControl
                aria-label="Group systems"
                value={preferences.group}
                onChange={(event) =>
                  update({ group: event.target.value as SystemBrowserState["group"] })
                }
              >
                <option value="era">Release era</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="none">No grouping</option>
              </SelectControl>
            </label>
          </div>
          {filtered && (
            <div className="system-browser-filter-summary">
              <span role="status">
                {visible.length} {visible.length === 1 ? "system matches" : "systems match"} your
                filters
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update({ query: "", manufacturer: "all" })}
              >
                Clear filters
              </Button>
            </div>
          )}
        </section>
        <div
          className="system-browser-content"
          id="system-results"
          role={"tabpanel"}
          aria-labelledby={`system-view-${preferences.view}`}
          aria-busy={!ready}
        >
          {error ? (
            <EmptyState
              alert
              icon={<Gamepad2 size={24} />}
              title="Systems are unavailable"
              description={error}
              actions={<Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button>}
            />
          ) : !ready ? (
            <div className="system-browser-grid" role="status" aria-label="Loading systems">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="system-browser-skeleton" />
              ))}
            </div>
          ) : (
            <>
              <div className="system-browser-results-heading">
                <h2>
                  {preferences.view === "yours" ? "Systems in your library" : "System catalog"}
                </h2>
                <span role="status">
                  {visible.length} {visible.length === 1 ? "system" : "systems"}
                </span>
              </div>
              {preferences.view === "yours" && yours.length > 0 && (
                <p className="system-browser-note">
                  Based on platforms in your game logs and games exclusive to one platform. System
                  catalog availability does not imply ownership.
                  {unassigned > 0 && (
                    <>
                      {" "}
                      {unassigned} {unassigned === 1 ? "game needs" : "games need"} a matching
                      platform in its log.
                    </>
                  )}
                </p>
              )}
              {preferences.view === "yours" && yours.length === 0 && unassigned > 0 && (
                <p className="system-browser-note">
                  {unassigned} {unassigned === 1 ? "game needs" : "games need"} a matching platform
                  in its log to appear here.
                </p>
              )}
              {visible.length === 0 ? (
                <EmptyState
                  icon={<Gamepad2 size={24} />}
                  title={
                    filtered ? "No systems match your filters" : "Your systems will appear here"
                  }
                  description={
                    filtered
                      ? "Try another name or manufacturer, or clear your filters."
                      : "Add a game and choose its platform in the game log to build your collection."
                  }
                  actions={
                    filtered ? (
                      <Button onClick={() => update({ query: "", manufacturer: "all" })}>
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={() => update({ view: "all" })}>
                        Browse all systems
                      </Button>
                    )
                  }
                />
              ) : preferences.group === "none" ? (
                cards(visible)
              ) : (
                <Accordion
                  multiple
                  collapsible
                  openItems={groups
                    .filter(
                      ([label]) => !preferences.collapsed.includes(`${preferences.group}:${label}`)
                    )
                    .map(([label]) => label)}
                  onToggle={(_event, data) =>
                    setPreferences((previous) => {
                      const currentKeys = new Set(
                        groups.map(([label]) => `${preferences.group}:${label}`)
                      );
                      return {
                        ...previous,
                        collapsed: [
                          ...previous.collapsed.filter((key) => !currentKeys.has(key)),
                          ...groups
                            .filter(([label]) => !data.openItems.includes(label))
                            .map(([label]) => `${preferences.group}:${label}`),
                        ],
                      };
                    })
                  }
                >
                  {groups.map(([label, items]) => (
                    <AccordionItem key={label} value={label}>
                      <AccordionHeader>
                        <span className="system-browser-group-heading">
                          {label}
                          <span className="system-browser-count">{items.length}</span>
                        </span>
                      </AccordionHeader>
                      <AccordionPanel>{cards(items)}</AccordionPanel>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
function SystemCard({
  platform,
  counts,
  onOpen,
}: {
  platform: SystemPlatform;
  counts?: SystemCounts;
  onOpen: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>();
  const hasLogo = !!platform.logoUrl && failedUrl !== platform.logoUrl;
  const loaded = hasLogo && loadedUrl === platform.logoUrl;
  const name = platform.name;
  return (
    <button type="button" className="system-browser-card" onClick={onOpen} title={name}>
      <span className={`system-browser-logo${loaded ? " has-art" : ""}`}>
        {(!loaded || !hasLogo) && <Gamepad2 size={28} aria-hidden="true" />}
        {hasLogo && (
          <img
            src={platform.logoUrl}
            alt=""
            loading="lazy"
            onLoad={() => setLoadedUrl(platform.logoUrl)}
            onError={() => setFailedUrl(platform.logoUrl)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        )}
      </span>
      <span className="system-browser-card-text">
        <strong>{name}</strong>
        <span>
          {platform.releaseYear ?? "Release year not listed"}
          {platform.manufacturers?.length
            ? ` · ${platform.manufacturers.join(", ")}`
            : platform.abbreviation
              ? ` · ${platform.abbreviation}`
              : ""}
        </span>
        {counts && (
          <span className="system-browser-library-count">
            {counts.games} {counts.games === 1 ? "game" : "games"} in library · {counts.backlog}{" "}
            backlog{counts.playing > 0 ? ` · ${counts.playing} playing` : ""}
          </span>
        )}
      </span>
      <ChevronRight className="system-browser-open" size={18} aria-hidden="true" />
    </button>
  );
}
