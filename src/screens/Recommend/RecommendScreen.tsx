import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ProgressBar } from "@fluentui/react-components";
import { db } from "../../db/schema";
import { LogsRepo } from "../../db/repositories/LogsRepo";
import { Button } from "../../components/ui/Button";
import { TextInput, SelectControl } from "../../components/ui/Controls";
import { PageHeader, EmptyState } from "../../components/ui/PageLayout";
import { OperationFeedback } from "../../components/ui/Feedback";
import { RecommendationPreferencesDialog } from "../../components/features/RecommendationPreferencesDialog";
import { Dices, RefreshCw, Sparkles } from "../../components/icons";
import { getRecommendations, type RecommenderCandidate } from "../../services/recommender";
import { readRecommendationFeedback, lessLike } from "../../services/recommendationFeedback";
import {
  eligiblePlayEntries,
  PLAY_POOLS,
  readPlayPreferences,
  type PlayPool,
} from "../../services/playEligibility";
import { notify, operationError } from "../../services/feedback";
import { PlayCover } from "./PlayCover";
import { RouletteModal } from "./RouletteModal";
import "./Recommend.css";
const PREFS_KEY = "gamelog.what-to-play.v1";
function savedPreferences() {
  try {
    return readPlayPreferences(sessionStorage.getItem(PREFS_KEY));
  } catch {
    return readPlayPreferences(null);
  }
}
export function RecommendScreen() {
  const [initial] = useState(savedPreferences);
  const [pool, setPool] = useState<PlayPool>(initial.pool);
  const [maxHours, setMaxHours] = useState<number | undefined>(initial.maxHours);
  const [intent, setIntent] = useState(initial.intent);
  const [submittedIntent, setSubmittedIntent] = useState(initial.intent);
  const appliedIntent = useRef(initial.intent);
  const [picks, setPicks] = useState<RecommenderCandidate[]>([]);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<"local" | "ai" | null>("local");
  const [message, setMessage] = useState("");
  const [roundMessage, setRoundMessage] = useState("");
  const [error, setError] = useState("");
  const [busyGame, setBusyGame] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(readRecommendationFeedback);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const preferencesTrigger = useRef<HTMLButtonElement>(null);
  const rouletteTrigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const navigate = useNavigate(),
    location = useLocation();
  const [params, setParams] = useSearchParams();
  const rouletteOpen = params.get("roulette") === "true";
  const library = useLiveQuery(async () => {
    const [games, logs] = await Promise.all([db.games.toArray(), db.logs.toArray()]);
    return { games, logs };
  });
  const eligible = useMemo(
    () =>
      library
        ? eligiblePlayEntries(library.games, library.logs, { pool, maxHours }).filter(
            (entry) => !feedback.some((hidden) => hidden.igdbId === entry.game.igdbId)
          )
        : [],
    [library, pool, maxHours, feedback]
  );
  const poolCounts = useMemo(
    () =>
      Object.fromEntries(
        PLAY_POOLS.map((option) => [
          option.value,
          library
            ? eligiblePlayEntries(library.games, library.logs, { pool: option.value }).filter(
                (entry) => !feedback.some((hidden) => hidden.igdbId === entry.game.igdbId)
              ).length
            : 0,
        ])
      ),
    [library, feedback]
  );
  const fetchPicks = useCallback(
    async (mood: string, excluded: number[], ai = false) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(ai ? "ai" : "local");
      setError("");
      try {
        const result = await getRecommendations(mood, excluded, {
          pool,
          maxHours,
          requestAi: ai,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setPicks(result.picks);
        setMessage(result.message);
        setSubmittedIntent(mood);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(operationError(err, "Could not load picks. Please try again."));
      } finally {
        if (!controller.signal.aborted) setLoading(null);
      }
    },
    [pool, maxHours, library, feedback]
  );
  useEffect(() => {
    if (!library) return;
    setExcludedIds([]);
    setRoundMessage("");
    void fetchPicks(appliedIntent.current, [], false);
    return () => request.current?.abort();
  }, [fetchPicks, library]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ pool, maxHours, intent: submittedIntent })
      );
    } catch {
      /* Browsing works without storage. */
    }
  }, [pool, maxHours, submittedIntent]);
  const setRoulette = useCallback(
    (open: boolean) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (open) next.set("roulette", "true");
          else next.delete("roulette");
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );
  useEffect(() => {
    if ((location.state as { openRoulette?: boolean } | null)?.openRoulette) {
      const next = new URLSearchParams(location.search);
      next.set("roulette", "true");
      navigate(
        { pathname: location.pathname, search: next.toString() },
        { replace: true, state: null }
      );
    }
  }, [location, navigate]);
  useEffect(() => {
    const open = () => setRoulette(true);
    window.addEventListener("gamelog:open-roulette", open);
    return () => window.removeEventListener("gamelog:open-roulette", open);
  }, [setRoulette]);
  const run = (ai: boolean) => {
    appliedIntent.current = intent.trim();
    setExcludedIds([]);
    setRoundMessage("");
    void fetchPicks(appliedIntent.current, [], ai);
  };
  const viewGame = (id: number) => {
    if (rouletteOpen) setRoulette(false);
    navigate(`/game/${id}`);
  };
  const actOnGame = async (id: number) => {
    if (busyGame !== null) return;
    setBusyGame(id);
    setError("");
    try {
      await db.transaction("rw", [db.games, db.logs], async () => {
        const game = await db.games.get(id),
          log = await db.logs.get(id);
        if (!game || !log || log.status === "Wishlist")
          throw new Error("This game is no longer in your playable library. Refresh your picks.");
        if (log.status === "Played") await LogsRepo.logSession(id);
        else if (log.status === "Backlog") await LogsRepo.updateStatus(id, "Playing");
      });
      notify("Your play record is ready", { intent: "success" });
      viewGame(id);
    } catch (err) {
      setError(operationError(err, "Could not update this game. Please try again."));
    } finally {
      setBusyGame(null);
    }
  };
  const others = () => {
    let next = [...new Set([...excludedIds, ...picks.map((pick) => pick.game.igdbId)])];
    if (eligible.every((entry) => next.includes(entry.game.igdbId))) {
      next = [];
      setRoundMessage("You have seen every eligible game. Starting a new round.");
    }
    setExcludedIds(next);
    void fetchPicks(appliedIntent.current, next);
  };
  const skip = (id: number) => {
    setExcludedIds((previous) => [...new Set([...previous, id])]);
    setPicks((previous) => previous.filter((pick) => pick.game.igdbId !== id));
  };
  const hide = (pick: RecommenderCandidate) => {
    try {
      setFeedback(lessLike(pick.game));
      preferencesTrigger.current?.focus();
    } catch (err) {
      setError(operationError(err, "Could not update recommendation preferences."));
    }
  };
  const reset = () => {
    setExcludedIds([]);
    void fetchPicks(appliedIntent.current, []);
  };
  return (
    <main id="main-content" className="recommend-screen">
      <PageHeader
        title="What to play"
        description="Choose something from your library, continue a game, or revisit an old favorite."
        count={library ? `${eligible.length} eligible` : undefined}
        actions={
          <>
            <Button ref={rouletteTrigger} onClick={() => setRoulette(true)}>
              <Dices size={16} /> Game roulette
            </Button>
            <Button ref={preferencesTrigger} onClick={() => setPreferencesOpen(true)}>
              Recommendation preferences{feedback.length ? ` (${feedback.length})` : ""}
            </Button>
          </>
        }
      />
      <div className="recommend-content">
        <section className="recommend-controls" aria-label="Choose your play pool">
          <div className="recommend-filter-row">
            <label>
              Play pool
              <SelectControl
                aria-label="Play pool"
                value={pool}
                onChange={(event) => setPool(event.target.value as PlayPool)}
              >
                {PLAY_POOLS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {library ? ` (${poolCounts[option.value]})` : ""}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label>
              Main-story length
              <SelectControl
                aria-label="Maximum story length"
                value={maxHours ?? "any"}
                onChange={(event) =>
                  setMaxHours(event.target.value === "any" ? undefined : Number(event.target.value))
                }
              >
                <option value="any">Any length</option>
                {[5, 10, 20, 40].map((hours) => (
                  <option key={hours} value={hours}>
                    Up to {hours} hours
                  </option>
                ))}
              </SelectControl>
            </label>
            <p className="recommend-help">
              Wishlist games are excluded. Played games return when no play date is recorded, or
              their latest recorded play was over a year ago.
            </p>
          </div>
          <form
            className="recommend-mood"
            onSubmit={(event) => {
              event.preventDefault();
              run(false);
            }}
          >
            <label>
              What are you in the mood for?
              <TextInput
                aria-label="What kind of game are you looking for?"
                placeholder="For example, a short RPG"
                value={intent}
                maxLength={500}
                onChange={(event) => setIntent(event.target.value)}
              />
            </label>
            <Button variant="primary" type="submit" disabled={!!loading}>
              Get picks
            </Button>
            <Button onClick={() => run(true)} disabled={!!loading || !eligible.length}>
              <Sparkles size={16} /> Refine with AI
            </Button>
            {loading === "ai" && (
              <Button
                onClick={() => {
                  request.current?.abort();
                  setLoading(null);
                  setMessage("AI refinement stopped. Your previous picks are still available.");
                }}
              >
                Stop
              </Button>
            )}
          </form>
          <p className="recommend-help">
            Get picks stays local. AI refinement sends your mood and up to 20 eligible titles and
            match signals to Gemini. Notes stay on this device.
          </p>
        </section>
        <OperationFeedback error={error} />
        {loading && (
          <div className="recommend-loading" role="status">
            <span>
              {loading === "ai" ? "Refining your picks…" : "Finding games in your library…"}
            </span>
            <ProgressBar />
          </div>
        )}
        {!loading && message && (
          <p className="recommend-help" role="status">
            {message}
          </p>
        )}
        {roundMessage && (
          <p className="recommend-help" role="status">
            {roundMessage}
          </p>
        )}
        <section className="recommend-results" aria-label="Your game picks" aria-busy={!!loading}>
          <div className="recommend-results-heading">
            <div>
              <h2>Top picks for you</h2>
              <p className="recommend-help">
                {submittedIntent
                  ? `Based on: “${submittedIntent}”`
                  : "Local suggestions from your selected play pool"}
              </p>
            </div>
            <div className="recommend-actions">
              <Button onClick={others} disabled={!!loading || !eligible.length}>
                <RefreshCw size={16} /> Show me others
              </Button>
              {!!excludedIds.length && (
                <Button onClick={reset} disabled={!!loading}>
                  Reset skipped games
                </Button>
              )}
            </div>
          </div>
          {!loading && !picks.length ? (
            <EmptyState
              title={eligible.length ? "No picks left in this round" : "No games in this play pool"}
              description={
                eligible.length
                  ? "Reset skipped games to see your eligible games again."
                  : "Try another play pool, remove the story-length limit, or review hidden recommendations."
              }
              actions={
                <>
                  {!eligible.length && (
                    <Button variant="primary" onClick={() => navigate("/")}>
                      Go to library
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setPool("ready");
                      setMaxHours(undefined);
                      reset();
                    }}
                  >
                    Reset filters and skips
                  </Button>
                  {!!feedback.length && (
                    <Button onClick={() => setPreferencesOpen(true)}>Review hidden games</Button>
                  )}
                </>
              }
            />
          ) : (
            <div className="recommend-picks">
              {picks.map((pick, index) => (
                <PickCard
                  key={pick.game.igdbId}
                  pick={pick}
                  rank={index + 1}
                  disabled={!!loading || busyGame !== null}
                  onOpen={() => viewGame(pick.game.igdbId)}
                  onAct={() => void actOnGame(pick.game.igdbId)}
                  onSkip={() => skip(pick.game.igdbId)}
                  onLessLike={() => hide(pick)}
                />
              ))}
            </div>
          )}
        </section>
        <details className="recommend-explanation">
          <summary>How picks and replay dates work</summary>
          <p>
            Local picks use your genres, ratings and available game metadata. Roulette chooses
            randomly from the same play pool and length filter; it does not use mood ranking.
          </p>
          <p>
            Replay dates use the latest valid start date, finish date or dated play session. Editing
            a rating or notes does not count as playing. Games with no valid play date are eligible
            to revisit; that does not mean they were never played.
          </p>
          <p>
            AI match signals can include shared genres, catalog story lengths, community ratings and
            references to your highly rated games. AI sees only the eligible shortlist and can make
            mistakes; local picks remain available if it fails.
          </p>
          <p>
            Story-length limits use the estimated full main story, not a session length or remaining
            playtime. Unknown estimates are excluded while a limit is set. Hiding a recommendation
            also removes it from roulette.
          </p>
        </details>
      </div>
      {preferencesOpen && (
        <RecommendationPreferencesDialog
          feedback={feedback}
          onChange={setFeedback}
          onClose={() => setPreferencesOpen(false)}
          restoreFocusRef={preferencesTrigger}
        />
      )}
      {rouletteOpen && (
        <RouletteModal
          entries={eligible}
          loading={!library}
          pool={pool}
          onPoolChange={setPool}
          maxHours={maxHours}
          busy={busyGame !== null}
          onClose={() => setRoulette(false)}
          onOpenGame={viewGame}
          onAct={actOnGame}
          error={error}
          restoreFocusRef={rouletteTrigger}
        />
      )}
    </main>
  );
}
function PickCard({
  pick,
  rank,
  disabled,
  onOpen,
  onAct,
  onSkip,
  onLessLike,
}: {
  pick: RecommenderCandidate;
  rank: number;
  disabled: boolean;
  onOpen: () => void;
  onAct: () => void;
  onSkip: () => void;
  onLessLike: () => void;
}) {
  const hours = pick.game.timeToBeat?.finish;
  return (
    <article
      className="recommend-pick"
      role="group"
      aria-label={`Recommendation: ${pick.game.title}`}
    >
      <button
        className="recommend-cover"
        aria-label={`View ${pick.game.title}`}
        onClick={onOpen}
        disabled={disabled}
      >
        <PlayCover game={pick.game} />
      </button>
      <div className="recommend-pick-body">
        <div className="recommend-pick-title">
          <span className="recommend-rank">{rank}</span>
          <h3>{pick.game.title}</h3>
          <span className="recommend-status">
            {pick.log.status === "Played" ? "Revisit" : pick.log.status}
          </span>
        </div>
        <p className="recommend-help">
          {[
            pick.game.developer !== "Unknown" ? pick.game.developer : "",
            pick.game.releaseYear || "",
            ...pick.game.genres.slice(0, 3),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {typeof hours === "number" && Number.isFinite(hours) && hours > 0 && (
          <p className="recommend-help">About {hours}h main story</p>
        )}
        <p className="recommend-reason">{pick.reason}</p>
        <div className="recommend-actions">
          <Button variant="primary" onClick={onOpen} disabled={disabled}>
            View game
          </Button>
          <Button onClick={onAct} disabled={disabled}>
            {pick.log.status === "Played"
              ? "Record play today"
              : pick.log.status === "Playing"
                ? "Continue playing"
                : "Mark as playing"}
          </Button>
          <Button onClick={onSkip} disabled={disabled}>
            Skip
          </Button>
          <Button onClick={onLessLike} disabled={disabled}>
            Less like this
          </Button>
        </div>
      </div>
    </article>
  );
}
