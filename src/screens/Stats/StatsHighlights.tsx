import { Link } from "react-router-dom";
import type { Game } from "../../types";
import type { computeLibraryStatistics, StatisticsRange } from "../../services/libraryStatistics";
import { HorizontalBarChart } from "./Charts";
import { COMPLETION_COLORS } from "../../components/ui/";
import type { Completion } from "../../types";
import "./StatsHighlights.css";
type Highlights = ReturnType<typeof computeLibraryStatistics>["highlights"];
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
export function StatsHighlights({
  highlights,
  range,
  backlogCount,
}: {
  highlights: Highlights;
  range: StatisticsRange;
  backlogCount: number;
}) {
  const h = highlights;
  return (
    <section aria-labelledby="statistics-highlights-title" className="statistics-highlights">
      <div>
        <h2 id="statistics-highlights-title">Your highlights</h2>
        <p className="statistics-highlight-help">
          {range === "all"
            ? "A closer look at the games in your library."
            : "Games marked Played with a recorded finish in the selected period. Game hours are their lifetime totals."}
        </p>
      </div>
      <div className="statistics-highlight-grid">
        <GameRanking
          title="Most played"
          entries={h.mostPlayed}
          unit="hours"
          count={h.hoursRecordedCount}
          empty="No playtime recorded for these games yet."
        />
        <GameRanking
          title="Personal favorites"
          entries={h.favorites}
          unit="rating"
          count={h.ratedCount}
          empty="Rate a game to see your favorites here."
        />
        <article className="statistics-highlight-card" aria-label="Completion rate">
          <h3>Completion rate</h3>
          <p className="statistics-highlight-number">
            {h.completion.rate === null ? "—" : `${h.completion.rate}%`}
          </p>
          <p className="statistics-highlight-help">
            {h.completion.knownOutcomes
              ? `${h.completion.completed} of ${h.completion.knownOutcomes} recorded outcomes are Completed or Mastered.`
              : "Set an outcome on a game marked Played to see your completion rate."}
            {h.completion.unspecified > 0
              ? ` ${h.completion.unspecified} without an outcome are excluded from this rate.`
              : ""}
          </p>
        </article>
        <article className="statistics-highlight-card" aria-label="Oldest backlog addition">
          <h3>
            Oldest backlog addition <span className="statistics-highlight-scope">All time</span>
          </h3>
          {h.oldestBacklog ? (
            <>
              <GameLink game={h.oldestBacklog.game} />
              <p className="statistics-highlight-number">
                {number(h.oldestBacklog.days)}{" "}
                <span>{h.oldestBacklog.days === 1 ? "day ago" : "days ago"}</span>
              </p>
              <p className="statistics-highlight-help">
                Added{" "}
                {new Date(h.oldestBacklog.game.addedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                ; currently in Backlog. This does not track past status changes.
              </p>
            </>
          ) : (
            <p className="statistics-highlight-help">
              {backlogCount
                ? "No backlog games have a valid added date."
                : "Your backlog is clear. No games waiting here."}
            </p>
          )}
        </article>
      </div>
      <div className="statistics-highlight-grid">
        <article className="statistics-highlight-card" aria-label="Playthrough outcomes">
          <h3>Playthrough outcomes</h3>
          <p className="statistics-highlight-help">
            Outcomes for games marked Played in this selection.
          </p>
          {h.outcomeData.some((item) => item.value > 0) ? (
            <HorizontalBarChart
              caption="Playthrough outcomes"
              data={h.outcomeData.map((item) => ({
                ...item,
                color: COMPLETION_COLORS[item.label as Completion] ?? "var(--app-tertiary-label)",
              }))}
            />
          ) : (
            <p className="statistics-highlight-help">
              No games marked Played in this selection yet.
            </p>
          )}
        </article>
        <article className="statistics-highlight-card" aria-label="Your library by release decade">
          <h3>Your library by release decade</h3>
          <p className="statistics-highlight-help">
            The eras your selected games come from, based on release year.
          </p>
          <HorizontalBarChart caption="Games by release decade" data={h.decadeData} />
        </article>
      </div>
    </section>
  );
}
function GameLink({ game }: { game: Game }) {
  return (
    <Link className="statistics-game-link" to={`/game/${game.igdbId}`}>
      {game.title}
    </Link>
  );
}
function GameRanking({
  title,
  entries,
  unit,
  count,
  empty,
}: {
  title: string;
  entries: { game: Game; value: number }[];
  unit: "hours" | "rating";
  count: number;
  empty: string;
}) {
  return (
    <article className="statistics-highlight-card" aria-label={title}>
      <h3>{title}</h3>
      {entries.length ? (
        <>
          <ol className="statistics-game-ranking">
            {entries.map(({ game, value }) => (
              <li key={game.igdbId}>
                {game.coverUrl && <img src={game.coverUrl} alt="" loading="lazy" />}
                <GameLink game={game} />
                <span className="statistics-game-value">
                  {number(value)}
                  {unit === "hours" ? "h" : " / 5"}
                </span>
              </li>
            ))}
          </ol>
          <p className="statistics-highlight-help">
            {unit === "hours"
              ? `Top ${entries.length} of ${count} ${count === 1 ? "game" : "games"} with recorded playtime. Lifetime totals for these games.`
              : `Top ${entries.length} of ${count} personally rated ${count === 1 ? "game" : "games"}. Equal ratings are listed alphabetically.`}
          </p>
        </>
      ) : (
        <p className="statistics-highlight-help">{empty}</p>
      )}
    </article>
  );
}
