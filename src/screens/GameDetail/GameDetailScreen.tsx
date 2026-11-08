import { TextInput } from "../../components/ui/Controls";
import { defaultSeriesGroup, seriesGroupGames, browseRelated } from "../../services/relatedGames";
import { useState, useRef, useId, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ProgressBar, TabList, Tab } from "@fluentui/react-components";
import { PageHeader, EmptyState } from "../../components/ui/PageLayout";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ChevronLeft, ChevronRight, Plus, Edit3, ExternalLink, Play } from "../../components/icons";
import { SessionHistoryDialog } from "../../components/features/SessionHistoryDialog";
import { ResumeRecapDialog } from "../../components/features/ResumeRecapDialog";
import { db } from "../../db/schema";
import { LogsRepo } from "../../db/repositories";
import { useGameDetail } from "../../hooks/useGameDetail";
import { useSimilarLibraryGames } from "../../hooks/useSimilarLibraryGames";
import { localDate } from "../../utils/dates";
import { activityDateLabel, validActivityDate } from "../../services/activity";
import { loggedPlatforms } from "../../services/libraryPresentation";
import {
  personalActivity,
  firstReleaseLabel,
  resolveRelatedTab,
  RELATED_TABS,
  RELATED_LABELS,
  RELATED_DESCRIPTIONS,
  type RelatedTabKey,
} from "../../services/gameDetailPresentation";
import { notify, operationError } from "../../services/feedback";
import type { Log } from "../../types";
import type { CatalogGame } from "../../catalog";
import { RelatedStrip } from "./RelatedStrip";
import "./GameDetail.css";
interface Props {
  onOpenLog: (id: number, prefill?: Partial<Log>, draft?: CatalogGame) => void;
  onOpenGame: (id: number) => void;
  onOpenAddToList?: (id: number, title: string) => void;
}
export function GameDetailScreen(props: Props) {
  const { igdbId: raw } = useParams<{ igdbId: string }>();
  const id = Number(raw),
    navigate = useNavigate();
  if (!Number.isSafeInteger(id) || id < 1)
    return (
      <main id="main-content" className="game-detail-screen">
        <PageHeader title="Game not found" />
        <EmptyState
          title="Choose a valid game"
          description="Return to your library and select a game."
          actions={<Button onClick={() => navigate("/")}>Go to library</Button>}
        />
      </main>
    );
  return <GameDetailContent key={id} id={id} {...props} />;
}
function GameDetailContent({ id, onOpenLog, onOpenGame, onOpenAddToList }: Props & { id: number }) {
  const navigate = useNavigate();
  const { detail, loading, refreshing, localFallback, error, retry } = useGameDetail(id);
  const entry = useLiveQuery(async () => {
    const [game, log] = await Promise.all([db.games.get(id), db.logs.get(id)]);
    return game && log ? { game, log } : null;
  }, [id]);
  const tags = useLiveQuery(() => db.tags.toArray()) ?? [];
  const similar = useSimilarLibraryGames(detail);
  const [pending, setPending] = useState<"" | "add" | "session">(""),
    [actionError, setActionError] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false),
    [recapOpen, setRecapOpen] = useState(false),
    [relatedTab, setRelatedTab] = useState<RelatedTabKey | null>(null);
  const sessionsTrigger = useRef<HTMLButtonElement>(null),
    recapTrigger = useRef<HTMLButtonElement>(null),
    mediaTrigger = useRef<HTMLButtonElement | null>(null);
  const [mediaIndex, setMediaIndex] = useState<number | null>(null),
    [allMedia, setAllMedia] = useState(false);
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/");
  };
  const add = async () => {
    if (!detail || pending) return;
    setPending("add");
    setActionError(null);
    const game: CatalogGame = {
      igdbId: id,
      title: detail.title,
      slug: detail.slug,
      developer: detail.developer ?? "Unknown",
      publisher: detail.publisher,
      releaseYear: detail.releaseYear,
      firstReleaseDate: detail.firstReleaseDate,
      summary: detail.summary,
      genres: detail.genres,
      platforms: detail.platforms,
      coverUrl: detail.coverUrl,
      timeToBeat: detail.timeToBeat ?? undefined,
      igdbRating: detail.igdbRating.score,
    };
    try {
      onOpenLog(id, undefined, game);
    } catch (err) {
      setActionError(operationError(err, "Could not add this game. Please try again."));
    } finally {
      setPending("");
    }
  };
  const markToday = async () => {
    if (pending) return;
    setPending("session");
    setActionError(null);
    try {
      const recorded = await LogsRepo.logSession(id);
      notify(recorded ? "Today's activity recorded" : "Today is already recorded", {
        message: "Used for your activity and streaks. Recorded hours are unchanged.",
      });
    } catch (err) {
      setActionError(operationError(err, "Could not record today's activity. Please try again."));
    } finally {
      setPending("");
    }
  };
  const log = entry?.log,
    activity = log ? personalActivity(log) : null,
    today = localDate();
  const currentRelated = detail ? resolveRelatedTab(detail, relatedTab) : null;
  const [seriesSearch, setSeriesSearch] = useState("");
  const seriesPreview = detail ? seriesGroupGames(detail, defaultSeriesGroup(detail)) : [];
  const previewGames =
    detail && currentRelated
      ? currentRelated === "series"
        ? browseRelated(
            seriesPreview,
            { query: seriesSearch, scope: "all", sort: "catalog" },
            new Set()
          )
        : detail.related[currentRelated]
      : [];
  const availableTabs = detail ? RELATED_TABS.filter((tab) => detail.related[tab]?.length) : [];
  const hasCatalogFacts =
    detail &&
    (detail.companies.length ||
      detail.themes.length ||
      detail.playerPersp.length ||
      detail.formattedMultiplayer.length ||
      detail.ageRatings.length ||
      detail.ageDescriptors.length ||
      detail.engines.length ||
      detail.franchise ||
      detail.altNames.length);
  const media = detail
    ? [
        ...detail.screenshots.map((image, i) => ({
          kind: "image" as const,
          src: image.url,
          label: `Screenshot ${i + 1}`,
        })),
        ...detail.artworks.map((image, i) => ({
          kind: "image" as const,
          src: image.url,
          label: `Artwork ${i + 1}`,
        })),
        ...detail.videos
          .filter((video) => /^[a-zA-Z0-9_-]{11}$/.test(video.videoId))
          .map((video) => ({
            kind: "video" as const,
            src: video.videoId,
            label: video.name || "Video",
          })),
      ]
    : [];
  const selectedMedia = mediaIndex !== null ? media[mediaIndex] : undefined;
  return (
    <main id="main-content" className="game-detail-screen">
      <PageHeader
        title={detail?.title ?? (loading ? "Loading game details" : "Game details")}
        description={
          detail
            ? [detail.developer ?? "Developer not listed", detail.releaseYear || undefined]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        leading={
          <Button variant="ghost" aria-label="Back" onClick={goBack}>
            <ChevronLeft size={20} />
          </Button>
        }
        actions={
          detail && entry !== undefined ? (
            <div className="detail-actions">
              {entry ? (
                <Button variant="primary" disabled={!!pending} onClick={() => onOpenLog(id)}>
                  <Edit3 size={18} />
                  Edit log
                </Button>
              ) : (
                <Button variant="primary" loading={pending === "add"} onClick={() => void add()}>
                  <Plus size={18} />
                  Add to library &amp; log
                </Button>
              )}
              {entry && onOpenAddToList && (
                <Button disabled={!!pending} onClick={() => onOpenAddToList(id, detail.title)}>
                  <Plus size={18} />
                  Add to list
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
      <div className="game-detail-content">
        {loading && !detail ? (
          <p role="status">Loading game details…</p>
        ) : !detail ? (
          <EmptyState
            alert
            title="Game details are unavailable"
            description={error ?? "This game could not be found."}
            actions={<Button onClick={retry}>Retry</Button>}
          />
        ) : (
          <>
            {localFallback && (
              <div className="detail-notice" role="status">
                Online details are unavailable. Showing saved game information; your log and saved
                recap are available. <Button onClick={retry}>Retry online details</Button>
              </div>
            )}
            {refreshing && (
              <p className="detail-help" role="status">
                Updating online details. Your saved log is available below.
              </p>
            )}
            {actionError && (
              <div role="alert" className="detail-error">
                {actionError}
                <Button size="sm" onClick={() => setActionError(null)}>
                  Dismiss
                </Button>
              </div>
            )}
            <section className="detail-overview" aria-label="Game overview">
              <div className="detail-cover">
                <DetailImage key={detail.coverUrl} src={detail.coverUrl} alt="" />
              </div>
              <div className="detail-overview-content">
                <dl className="detail-facts">
                  <Fact label="First release" value={firstReleaseLabel(detail)} />
                  <Fact label="Game modes" value={detail.gameModes.join(", ") || "Not listed"} />
                  <Fact label="Available on" value={detail.platforms.join(", ") || "Not listed"} />
                </dl>
                <p className="detail-help">
                  Available platforms describe catalog releases, not your recorded platforms.
                </p>
                <div className="detail-scores">
                  {[
                    { label: "Community score", value: detail.igdbRating, countLabel: "ratings" },
                    { label: "Critic score", value: detail.criticRating, countLabel: "reviews" },
                  ]
                    .filter((score) => score.value.score !== undefined)
                    .map((score) => (
                      <div key={score.label}>
                        <span>{score.label}</span>
                        <strong>
                          {score.value.score}
                          <small> / 100</small>
                        </strong>
                        {score.value.count !== undefined && (
                          <small>
                            {score.value.count.toLocaleString()} {score.countLabel}
                          </small>
                        )}
                      </div>
                    ))}
                </div>
                {detail.genres.length > 0 && (
                  <p className="detail-help">
                    <strong>Genres:</strong> {detail.genres.join(" · ")}
                  </p>
                )}
              </div>
            </section>
            {entry === undefined ? (
              <p role="status">Loading your log…</p>
            ) : log && activity ? (
              <section className="detail-surface" aria-labelledby="personal-log-title">
                <div className="detail-section-heading">
                  <h2 id="personal-log-title">Your log</h2>
                  <span className="detail-status">
                    {log.status}
                    {log.status === "Played" && log.completion ? ` · ${log.completion}` : ""}
                  </span>
                </div>
                <dl className="detail-personal-facts">
                  <Fact
                    label="Your rating"
                    value={
                      typeof log.rating === "number" && log.rating >= 0.5 && log.rating <= 5
                        ? `${log.rating} / 5`
                        : "Not rated"
                    }
                  />
                  <Fact
                    label="Recorded platforms"
                    value={loggedPlatforms(log).join(", ") || "Not recorded"}
                  />
                  <Fact
                    label="Time played"
                    value={
                      typeof log.timePlayed === "number" &&
                      Number.isFinite(log.timePlayed) &&
                      log.timePlayed >= 0
                        ? `${log.timePlayed}h`
                        : "Not recorded"
                    }
                  />
                  {typeof log.completionPercentage === "number" &&
                    Number.isFinite(log.completionPercentage) &&
                    log.completionPercentage >= 0 &&
                    log.completionPercentage <= 100 && (
                      <div>
                        <dt>Completion</dt>
                        <dd>
                          {log.completionPercentage}%
                          {
                            <ProgressBar
                              value={log.completionPercentage / 100}
                              aria-label="Your completion progress"
                            />
                          }
                        </dd>
                      </div>
                    )}
                  <Fact label="Play sessions" value={String(activity.sessions)} />
                  <Fact
                    label="Last played"
                    value={
                      activity.lastPlayed
                        ? activityDateLabel(activity.lastPlayed)
                        : "No dated session"
                    }
                  />
                </dl>
                {activity.sessions > 0 && (
                  <p className="detail-help">
                    {activity.sessionHours}h in dated sessions
                    {activity.unknownDuration
                      ? ` · ${activity.unknownDuration} without duration`
                      : ""}
                    . Session hours and your total time played are separate records.
                  </p>
                )}
                <div className="detail-actions">
                  <Button
                    ref={sessionsTrigger}
                    disabled={!!pending}
                    onClick={() => setSessionsOpen(true)}
                  >
                    Session history
                  </Button>
                  {(log.status === "Playing" || log.status === "Played") && (
                    <Button
                      loading={pending === "session"}
                      disabled={
                        !!pending || log.playSessions?.some((session) => session.date === today)
                      }
                      onClick={() => void markToday()}
                    >
                      {log.playSessions?.some((session) => session.date === today)
                        ? "Played today"
                        : "Mark played today"}
                    </Button>
                  )}
                  <Button
                    ref={recapTrigger}
                    disabled={!!pending}
                    onClick={() => setRecapOpen(true)}
                  >
                    {log.resumeRecap ? "View resume recap" : "Resume recap"}
                  </Button>
                </div>
                {log.notes && (
                  <div className="detail-notes">
                    <h3>Your notes</h3>
                    <ExpandableText text={log.notes} label="notes" />
                  </div>
                )}
                <details className="detail-disclosure">
                  <summary>More log details</summary>
                  <dl className="detail-facts">
                    {validActivityDate(log.startedAt) && (
                      <Fact label="Started" value={activityDateLabel(log.startedAt)} />
                    )}{" "}
                    {log.status === "Played" && validActivityDate(log.finishedAt) && (
                      <Fact
                        label={
                          log.completion === "Abandoned"
                            ? "Stopped"
                            : log.completion === "Shelved"
                              ? "Shelved"
                              : "Finished"
                        }
                        value={activityDateLabel(log.finishedAt)}
                      />
                    )}{" "}
                    {!!log.ownership?.length && (
                      <Fact label="Ownership" value={log.ownership.join(", ")} />
                    )}{" "}
                    {entry &&
                      Number.isFinite(entry.game.addedAt) &&
                      entry.game.addedAt > 0 &&
                      entry.game.addedAt <= Date.now() && (
                        <Fact
                          label="Added to library"
                          value={new Date(entry.game.addedAt).toLocaleDateString()}
                        />
                      )}{" "}
                    {!!log.tagIds?.length && (
                      <Fact
                        label="Your tags"
                        value={
                          tags
                            .filter((tag) => log.tagIds?.includes(tag.id))
                            .map((tag) => tag.name)
                            .join(", ") || "Not recorded"
                        }
                      />
                    )}
                  </dl>
                </details>
              </section>
            ) : (
              <div className="detail-notice">
                This game isn’t in your library yet. Use Add to library &amp; log to start a
                personal record.
              </div>
            )}
            <section className="detail-surface" aria-labelledby="about-game-title">
              <h2 id="about-game-title">About this game</h2>
              {detail.summary ? (
                <ExpandableText text={detail.summary} label="description" />
              ) : (
                <p className="detail-help">No description is available.</p>
              )}
              {detail.storyline && (
                <details className="detail-disclosure">
                  <summary>Storyline (may contain spoilers)</summary>
                  <p className="detail-prose">{detail.storyline}</p>
                </details>
              )}
              {detail.timeToBeat &&
                [
                  detail.timeToBeat.average,
                  detail.timeToBeat.finish,
                  detail.timeToBeat.master,
                ].some(
                  (value) => typeof value === "number" && Number.isFinite(value) && value > 0
                ) && (
                  <div>
                    <h3>Estimated time to beat</h3>
                    <dl className="detail-facts">
                      {[
                        { label: "Quick run", value: detail.timeToBeat.average },
                        { label: "Main story", value: detail.timeToBeat.finish },
                        { label: "Completionist", value: detail.timeToBeat.master },
                      ]
                        .filter(
                          (item) =>
                            typeof item.value === "number" &&
                            Number.isFinite(item.value) &&
                            item.value > 0
                        )
                        .map((item) => (
                          <Fact key={item.label} label={item.label} value={`${item.value}h`} />
                        ))}
                    </dl>
                    <p className="detail-help">
                      Catalog estimates, separate from your recorded playtime.
                    </p>
                  </div>
                )}
              {hasCatalogFacts ? (
                <details className="detail-disclosure">
                  <summary>Catalog details</summary>
                  <dl className="detail-facts">
                    {detail.companies.map((company) => (
                      <Fact
                        key={company.name}
                        label={company.roles.join(", ")}
                        value={company.name}
                      />
                    ))}
                    {detail.themes.length > 0 && (
                      <Fact label="Themes" value={detail.themes.join(", ")} />
                    )}{" "}
                    {detail.playerPersp.length > 0 && (
                      <Fact label="Perspective" value={detail.playerPersp.join(", ")} />
                    )}{" "}
                    {detail.formattedMultiplayer.length > 0 && (
                      <Fact label="Multiplayer" value={detail.formattedMultiplayer.join("; ")} />
                    )}{" "}
                    {detail.ageRatings.length > 0 && (
                      <Fact label="Age rating" value={detail.ageRatings.join(" · ")} />
                    )}{" "}
                    {detail.ageDescriptors.length > 0 && (
                      <Fact label="Content descriptors" value={detail.ageDescriptors.join(", ")} />
                    )}{" "}
                    {detail.engines.length > 0 && (
                      <Fact label="Engines" value={detail.engines.join(", ")} />
                    )}{" "}
                    {detail.franchise && (
                      <Fact label="Franchise / series" value={detail.franchise} />
                    )}{" "}
                    {detail.altNames.length > 0 && (
                      <Fact
                        label="Other names"
                        value={detail.altNames.map((name) => name.name).join(", ")}
                      />
                    )}
                  </dl>
                </details>
              ) : null}
              {detail.releaseDates.length > 0 && (
                <details className="detail-disclosure">
                  <summary>Release history ({detail.releaseDates.length})</summary>
                  <dl className="detail-facts">
                    {detail.releaseDates.map((release, index) => (
                      <Fact
                        key={index}
                        label={[release.platform ?? "Platform not listed", release.region]
                          .filter(Boolean)
                          .join(" · ")}
                        value={release.date || "Date not listed"}
                      />
                    ))}
                  </dl>
                </details>
              )}
              {detail.languages.length > 0 && (
                <details className="detail-disclosure">
                  <summary>Language support ({detail.languages.length})</summary>
                  <dl className="detail-facts">
                    {detail.languages.map((language) => (
                      <Fact
                        key={language.language}
                        label={language.language}
                        value={language.types.join(", ")}
                      />
                    ))}
                  </dl>
                </details>
              )}
            </section>
            {detail.websites.length > 0 && (
              <section className="detail-surface" aria-label="Game links">
                <h2>Links</h2>
                <div className="detail-links">
                  {detail.websites.map((website) => (
                    <a key={website.url} href={website.url} target="_blank" rel="noreferrer">
                      {website.categoryName}
                      <ExternalLink size={16} aria-hidden="true" />
                      <span className="sr-only"> (opens in a new window)</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
            {media.length > 0 && (
              <section className="detail-surface" aria-label="Game media">
                <h2>Media</h2>
                <div className="detail-media-grid">
                  {media.slice(0, allMedia ? media.length : 6).map((item, index) => (
                    <button
                      key={`${item.kind}-${index}`}
                      type="button"
                      className="detail-media-button"
                      aria-label={`Open ${item.label}`}
                      onClick={(event) => {
                        mediaTrigger.current = event.currentTarget;
                        setMediaIndex(index);
                      }}
                    >
                      {item.kind === "image" ? (
                        <DetailImage src={item.src} alt="" />
                      ) : (
                        <Play size={32} aria-hidden="true" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                {media.length > 6 && (
                  <Button onClick={() => setAllMedia(!allMedia)} aria-expanded={allMedia}>
                    {allMedia ? "Show fewer media items" : `Show all media (${media.length})`}
                  </Button>
                )}
              </section>
            )}
            {currentRelated && (
              <section className="detail-surface" aria-label="Related games">
                <h2>Related games</h2>
                <p className="detail-help">
                  {currentRelated === "series" && defaultSeriesGroup(detail) === "collections"
                    ? "Named series entries for this game. View all to choose a series or explore the wider franchise."
                    : RELATED_DESCRIPTIONS[currentRelated]}
                </p>
                {
                  <TabList
                    className="related-category-tabs"
                    aria-label="Related game categories"
                    selectedValue={currentRelated}
                    onTabSelect={(_event, data) => setRelatedTab(data.value as RelatedTabKey)}
                  >
                    {availableTabs.map((tab) => (
                      <Tab
                        id={`detail-related-${tab}`}
                        aria-controls="detail-related-results"
                        value={tab}
                        key={tab}
                      >
                        {RELATED_LABELS[tab]} ({detail.related[tab].length})
                      </Tab>
                    ))}
                  </TabList>
                }
                {currentRelated === "series" && (
                  <label className="related-preview-search">
                    Find a series entry
                    <TextInput
                      aria-label="Find a series entry"
                      placeholder="Title words or number"
                      value={seriesSearch}
                      onChange={(event) => setSeriesSearch(event.target.value)}
                    />
                  </label>
                )}
                <div
                  id="detail-related-results"
                  role={"tabpanel"}
                  aria-labelledby={`detail-related-${currentRelated}`}
                >
                  <div className="detail-section-heading">
                    <span className="detail-help">
                      Showing {Math.min(8, previewGames.length)} of {previewGames.length}{" "}
                      {previewGames.length === 1 ? "game" : "games"}
                      {currentRelated === "series" && defaultSeriesGroup(detail) === "collections"
                        ? " in named series"
                        : ""}
                    </span>
                    <Button
                      onClick={() =>
                        navigate(
                          `/game/${id}/related?${new URLSearchParams({ tab: currentRelated, ...(currentRelated === "series" && seriesSearch ? { q: seriesSearch } : {}) })}`
                        )
                      }
                    >
                      View all
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                  <RelatedStrip games={previewGames.slice(0, 8)} onGameClick={onOpenGame} />
                </div>
              </section>
            )}
            {similar.length > 0 && (
              <section className="detail-surface" aria-label="Similar games in your library">
                <h2>Games like this from your library</h2>
                <RelatedStrip games={similar} onGameClick={onOpenGame} />
              </section>
            )}
          </>
        )}
      </div>
      {sessionsOpen && log && detail && (
        <SessionHistoryDialog
          igdbId={id}
          title={detail.title}
          log={log}
          onClose={() => setSessionsOpen(false)}
          restoreFocusRef={sessionsTrigger}
        />
      )}
      {recapOpen && detail && (
        <ResumeRecapDialog
          igdbId={id}
          title={detail.title}
          onClose={() => setRecapOpen(false)}
          restoreFocusRef={recapTrigger}
        />
      )}
      {selectedMedia && mediaIndex !== null && (
        <Modal
          isOpen
          title={selectedMedia.label}
          width={960}
          onClose={() => setMediaIndex(null)}
          restoreFocusRef={mediaTrigger}
        >
          <div
            className="detail-media-viewer"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" && mediaIndex < media.length - 1) {
                event.preventDefault();
                setMediaIndex(mediaIndex + 1);
              }
              if (event.key === "ArrowLeft" && mediaIndex > 0) {
                event.preventDefault();
                setMediaIndex(mediaIndex - 1);
              }
            }}
          >
            {selectedMedia.kind === "image" ? (
              <DetailImage
                key={selectedMedia.src}
                src={selectedMedia.src}
                alt={selectedMedia.label}
              />
            ) : (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedMedia.src}`}
                title={selectedMedia.label}
                allowFullScreen
              />
            )}
            <div className="detail-section-heading">
              <Button disabled={mediaIndex === 0} onClick={() => setMediaIndex(mediaIndex - 1)}>
                Previous media
              </Button>
              <span>
                {mediaIndex + 1} of {media.length}
              </span>
              <Button
                disabled={mediaIndex === media.length - 1}
                onClick={() => setMediaIndex(mediaIndex + 1)}
              >
                Next media
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function ExpandableText({ text, label }: { text: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div>
      <p id={id} className="detail-prose">
        {expanded || text.length <= 320 ? text : text.slice(0, 320).trimEnd() + "…"}
      </p>
      {text.length > 320 && (
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? `Show less ${label}` : `Read more ${label}`}
        </Button>
      )}
    </div>
  );
}
function DetailImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span
      className="detail-image-missing"
      role={alt ? "img" : undefined}
      aria-label={alt ? `${alt} unavailable` : undefined}
    >
      Image unavailable
    </span>
  );
}
