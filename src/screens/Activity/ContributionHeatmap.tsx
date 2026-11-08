import { useMemo, useRef, useState } from "react";
import { activityCalendar, activityDateLabel, type ActivityEvent } from "../../services/activity";
import { Button } from "../../components/ui/Button";
export function ContributionHeatmap({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: ActivityEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const calendar = useMemo(() => activityCalendar(events), [events]);
  const [focused, setFocused] = useState(364);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { cells, leading } = calendar;
  const columns = Math.ceil((leading + cells.length) / 7);
  return (
    <section
      className="activity-surface activity-calendar"
      aria-labelledby="activity-calendar-title"
    >
      <div className="activity-section-heading">
        <div>
          <h2 id="activity-calendar-title">Play calendar</h2>
          <p>
            {activityDateLabel(cells[0]!.date)} – {activityDateLabel(cells.at(-1)!.date)} · Last 365
            days
          </p>
        </div>
        <div className="activity-calendar-totals">
          <span>
            <strong>{calendar.activeDays}</strong> play days
          </span>
          <span>
            <strong>{calendar.currentStreak}</strong> current streak
          </span>
          <span>
            <strong>{calendar.bestStreak}</strong> longest streak
          </span>
        </div>
      </div>
      <p className="activity-help">
        Sessions, start dates and recorded outcomes count as play activity. Select a day to view its
        journal entries. Use arrow keys to move between days.
      </p>
      <div className="activity-calendar-scroll">
        <div
          className="activity-calendar-grid"
          role="group"
          aria-label="Play activity calendar"
          style={{ gridTemplateColumns: `28px repeat(${columns}, minmax(10px, 1fr))` }}
        >
          {cells.map((cell, index) =>
            cell.date.endsWith("-01") ? (
              <span
                key={`month-${cell.date}`}
                className="activity-calendar-month"
                aria-hidden="true"
                style={{ gridColumn: Math.floor((leading + index) / 7) + 2, gridRow: 1 }}
              >
                {new Date(cell.date + "T12:00:00").toLocaleDateString(undefined, {
                  month: "short",
                })}
              </span>
            ) : null
          )}
          {[1, 3, 5].map((day) => (
            <span
              key={day}
              className="activity-calendar-weekday"
              aria-hidden="true"
              style={{ gridColumn: 1, gridRow: day + 2 }}
            >
              {new Date(2026, 0, 4 + day).toLocaleDateString(undefined, { weekday: "short" })}
            </span>
          ))}
          {cells.map((cell, index) => {
            const label = `${activityDateLabel(cell.date)}: ${cell.count} ${cell.count === 1 ? "play entry" : "play entries"}`;
            return (
              <button
                key={cell.date}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                type="button"
                className={`activity-day activity-day-level-${Math.min(4, cell.count)}`}
                style={{
                  gridColumn: Math.floor((leading + index) / 7) + 2,
                  gridRow: ((leading + index) % 7) + 2,
                }}
                aria-label={label}
                title={label}
                aria-pressed={selectedDate === cell.date}
                tabIndex={focused === index ? 0 : -1}
                onFocus={() => setFocused(index)}
                onClick={() => onSelectDate(selectedDate === cell.date ? null : cell.date)}
                onKeyDown={(event) => {
                  const step =
                    event.key === "ArrowRight"
                      ? 7
                      : event.key === "ArrowLeft"
                        ? -7
                        : event.key === "ArrowDown"
                          ? 1
                          : event.key === "ArrowUp"
                            ? -1
                            : 0;
                  const next =
                    event.key === "Home"
                      ? Math.max(0, index - ((leading + index) % 7))
                      : event.key === "End"
                        ? Math.min(364, index + 6 - ((leading + index) % 7))
                        : step
                          ? Math.max(0, Math.min(364, index + step))
                          : null;
                  if (next !== null) {
                    event.preventDefault();
                    refs.current[next]?.focus();
                  }
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="activity-calendar-footer">
        <span>
          {selectedDate
            ? `Selected: ${activityDateLabel(selectedDate)}`
            : "Each square is one day; stronger color means more play entries."}
        </span>
        {selectedDate && (
          <Button size="sm" onClick={() => onSelectDate(null)}>
            Clear day
          </Button>
        )}
        <span
          className="activity-calendar-legend"
          aria-label="Calendar intensity: fewer to more play entries"
        >
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`activity-day-level-${level}`} aria-hidden="true" />
          ))}
          More
        </span>
      </div>
    </section>
  );
}
