import { SelectControl } from "../../components/ui/Controls";
import { buildActivityEvents, isPlayEvent } from "../../services/activity";
import { useState, useMemo, type RefObject } from "react";
import type { Game, Log } from "../../types";
import { computeYearInReview } from "../../services/yearInReview";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { StarRating } from "../../components/ui/";
import { Copy, ChevronLeft, ChevronRight } from "../../components/icons";

interface YearInReviewModalProps {
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  games: Game[];
  logs: Log[];
}
const sections = ["Overview", "Genres", "Top games", "Play habits", "Summary"];
export function YearInReviewModal({
  onClose,
  games,
  logs,
  restoreFocusRef,
}: YearInReviewModalProps) {
  const [slide, setSlide] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const years = [
    ...new Set([
      new Date().getFullYear(),
      ...buildActivityEvents(games, logs)
        .filter(isPlayEvent)
        .map((event) => Number(event.date.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);
  const stats = useMemo(() => computeYearInReview(games, logs, year), [games, logs, year]);
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(
        `${year} in Gamelog\n${stats.totalHours} hours recorded | ${stats.completedCount} games completed | ${stats.activeCount} games played\nTop genre: ${stats.topGenres[0]?.name ?? "Not recorded"}\n${stats.personaTitle}: ${stats.personaDesc}`
      );
      setCopyMessage("Summary copied to clipboard.");
    } catch {
      setCopyMessage("Could not access the clipboard. Please try again.");
    }
  };
  return (
    <Modal
      title={`${year} year in review`}
      isOpen
      onClose={onClose}
      restoreFocusRef={restoreFocusRef}
      width={600}
    >
      <div className="year-review-body">
        <label className="activity-review-year">
          Review year
          <SelectControl
            aria-label="Review year"
            value={String(year)}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setSlide(0);
              setCopyMessage("");
            }}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectControl>
        </label>
        <p className="year-review-step">
          {slide + 1} of {sections.length} | {sections[slide]}
        </p>
        <section aria-live="polite" className="year-review-section">
          {slide === 0 && (
            <>
              <h3>Your gaming year</h3>
              <p>Your recorded activity from January through December {year}.</p>
              <dl className="year-review-metrics">
                <div>
                  <dt>Recorded playtime</dt>
                  <dd>{stats.totalHours}h</dd>
                </div>
                <div>
                  <dt>Games completed</dt>
                  <dd>{stats.completedCount}</dd>
                </div>
              </dl>
              {stats.activeCount === 0 && (
                <p>
                  No dated gameplay recorded for this year yet. Add dates or play sessions to your
                  game logs to include them here.
                </p>
              )}
            </>
          )}
          {slide === 1 && (
            <>
              <h3>Top genres</h3>
              <p>Genres of the games you played this year.</p>
              {stats.topGenres.length ? (
                <ul className="year-review-list">
                  {stats.topGenres.map((genre) => (
                    <li key={genre.name}>
                      <span>{genre.name}</span>
                      <span>
                        {genre.count} {genre.count === 1 ? "game" : "games"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No genres recorded for this year.</p>
              )}
            </>
          )}
          {slide === 2 && (
            <>
              <h3>Highest rated games</h3>
              <p>Your ratings for games played this year.</p>
              {stats.topRated.length ? (
                <ul className="year-review-list">
                  {stats.topRated.map(({ game, log }) => (
                    <li key={game.igdbId}>
                      {game.coverUrl && <img src={game.coverUrl} alt="" />}
                      <strong>{game.title}</strong>
                      <StarRating rating={log.rating!} size={16} showValue />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No rated games recorded for this year.</p>
              )}
            </>
          )}
          {slide === 3 && (
            <>
              <h3>Play habits</h3>
              <dl className="year-review-metrics">
                <div>
                  <dt>Games played</dt>
                  <dd>{stats.activeCount}</dd>
                </div>
                <div>
                  <dt>Most active day</dt>
                  <dd>{stats.favoriteDay}</dd>
                </div>
              </dl>
              <p>Playtime and weekday totals use dated play sessions.</p>
            </>
          )}
          {slide === 4 && (
            <>
              <h3>{stats.personaTitle}</h3>
              <p>{stats.personaDesc}</p>
              <dl className="year-review-metrics">
                <div>
                  <dt>Recorded playtime</dt>
                  <dd>{stats.totalHours}h</dd>
                </div>
                <div>
                  <dt>Games completed</dt>
                  <dd>{stats.completedCount}</dd>
                </div>
              </dl>
              <Button onClick={copySummary}>
                <Copy size={16} />
                Copy summary
              </Button>
              <p role="status">{copyMessage}</p>
            </>
          )}
        </section>
      </div>
      <div className="year-review-footer">
        <Button disabled={slide === 0} onClick={() => setSlide((s) => s - 1)}>
          <ChevronLeft size={16} />
          Previous
        </Button>
        <Button
          variant="primary"
          onClick={() => (slide === sections.length - 1 ? onClose() : setSlide((s) => s + 1))}
        >
          {slide === sections.length - 1 ? "Done" : "Next"}
          <ChevronRight size={16} />
        </Button>
      </div>
    </Modal>
  );
}
