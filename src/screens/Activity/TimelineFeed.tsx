import { useEffect, useState } from "react";
import { Clock, Play, CheckCircle2, PlusCircle } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { activityDateLabel, type ActivityEvent } from "../../services/activity";
export function TimelineFeed({
  events,
  onOpenGame,
}: {
  events: ActivityEvent[];
  onOpenGame: (id: number) => void;
}) {
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [events]);
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events.slice(0, limit)) {
    const group = groups.get(event.date) ?? [];
    group.push(event);
    groups.set(event.date, group);
  }
  const icons = { session: Clock, started: Play, finished: CheckCircle2, added: PlusCircle };
  return (
    <section className="activity-journal" aria-labelledby="activity-journal-title">
      <div className="activity-section-heading">
        <h2 id="activity-journal-title">Journal entries</h2>
        <span role="status">
          {events.length} {events.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {!events.length && (
        <div className="activity-surface activity-empty">
          <h3>No entries match this selection</h3>
          <p>
            Try another date, clear the game search, or choose All entries. Log a session or a play
            date to build your journal.
          </p>
        </div>
      )}
      {[...groups.entries()].map(([date, group]) => (
        <section className="activity-date-group" key={date} aria-label={activityDateLabel(date)}>
          <h3>
            <time dateTime={date}>{activityDateLabel(date)}</time>
          </h3>
          <ol className="activity-event-list">
            {group.map((event) => {
              const Icon = icons[event.type];
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    className="activity-event"
                    aria-label={`${event.title}: ${event.game.title}`}
                    onClick={() => onOpenGame(event.game.igdbId)}
                  >
                    <Icon size={20} aria-hidden="true" />
                    {event.game.coverUrl && <img src={event.game.coverUrl} alt="" loading="lazy" />}
                    <span className="activity-event-copy">
                      <span className="activity-event-kind">{event.title}</span>
                      <strong>{event.game.title}</strong>
                      <span>{event.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {events.length > limit && (
        <Button onClick={() => setLimit((current) => current + 50)}>
          Show more entries ({events.length - limit} remaining)
        </Button>
      )}
    </section>
  );
}
