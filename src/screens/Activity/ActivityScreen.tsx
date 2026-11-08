import { useState, useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { db } from "../../db/schema";
import { evaluateAchievements } from "../../services/achievements";
import {
  buildActivityEvents,
  selectActivity,
  summarizeActivity,
  isPlayEvent,
  activityDateLabel,
  type ActivityPeriod,
  type ActivityType,
} from "../../services/activity";
import { localDate } from "../../utils/dates";
import { PageHeader } from "../../components/ui/PageLayout";
import { TextInput, SelectControl } from "../../components/ui/Controls";
import { Button } from "../../components/ui/Button";
import { Calendar, Trophy } from "../../components/icons";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { TimelineFeed } from "./TimelineFeed";
import { AchievementsSection } from "./AchievementsSection";
import { YearInReviewModal } from "./YearInReviewModal";
import { ActivityTabs } from "./ActivityTabs";
import "./Activity.css";
export function ActivityScreen() {
  const [activeTab, setActiveTab] = useState<"journal" | "achievements">("journal");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<ActivityPeriod>("month");
  const [type, setType] = useState<ActivityType | "all">("all"),
    [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const wrappedOpen = searchParams.get("year-in-review") === "true";
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    if ((location.state as { openYearInReview?: boolean } | null)?.openYearInReview) {
      const params = new URLSearchParams(location.search);
      params.set("year-in-review", "true");
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true, state: {} }
      );
    }
    const open = () =>
      setSearchParams((previous) => {
        previous.set("year-in-review", "true");
        return previous;
      });
    window.addEventListener("gamelog:open-year-in-review", open);
    return () => window.removeEventListener("gamelog:open-year-in-review", open);
  }, [location, navigate, setSearchParams]);
  const games = useLiveQuery(() => db.games.toArray()),
    logs = useLiveQuery(() => db.logs.toArray());
  const events = useMemo(() => buildActivityEvents(games ?? [], logs ?? []), [games, logs]);
  const selected = useMemo(
    () => selectActivity(events, period, selectedDate),
    [events, period, selectedDate]
  );
  const summary = useMemo(() => summarizeActivity(selected), [selected]);
  const filtered = useMemo(
    () =>
      selected.filter(
        (event) =>
          (type === "all" || event.type === type) &&
          event.game.title.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [selected, type, search]
  );
  const achievements = useMemo(() => evaluateAchievements(games ?? [], logs ?? []), [games, logs]);
  const today = localDate();
  const memories = events
    .filter(
      (event) =>
        isPlayEvent(event) &&
        event.date.slice(5) === today.slice(5) &&
        event.date.slice(0, 4) < today.slice(0, 4)
    )
    .slice(0, 3);
  const selectDay = (date: string | null) => {
    setSelectedDate(date);
    if (date) setPeriod("all");
  };
  const scope = selectedDate
    ? activityDateLabel(selectedDate)
    : period === "month"
      ? new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : period === "year"
        ? String(new Date().getFullYear())
        : period === "days30"
          ? "Last 30 days"
          : "All time";
  return (
    <main id="main-content" className="activity-screen">
      <PageHeader
        title="Activity"
        description="Your recorded play, milestones and library journal."
        actions={
          <Button
            ref={reviewTrigger}
            onClick={() =>
              setSearchParams((previous) => {
                previous.set("year-in-review", "true");
                return previous;
              })
            }
          >
            <Calendar size={18} aria-hidden="true" />
            Year in review
          </Button>
        }
      />
      <div className="activity-content">
        {!games || !logs ? (
          <p role="status">Loading activity…</p>
        ) : (
          <>
            <ActivityTabs
              label="Activity views"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                {
                  value: "journal",
                  label: "Play journal",
                  icon: <Calendar size={18} />,
                  controls: "activity-journal-panel",
                },
                {
                  value: "achievements",
                  label: "Achievements",
                  icon: <Trophy size={18} />,
                  controls: "activity-achievements-panel",
                },
              ]}
            />
            {activeTab === "journal" ? (
              <div
                id="activity-journal-panel"
                role={"tabpanel"}
                aria-labelledby={"activity-journal-panel-journal-tab"}
                className="activity-panel"
              >
                <section className="activity-filters" aria-label="Journal filters">
                  <label>
                    Period
                    <SelectControl
                      aria-label="Journal period"
                      value={period}
                      onChange={(event) => {
                        setPeriod(event.target.value as ActivityPeriod);
                        setSelectedDate(null);
                      }}
                    >
                      <option value="month">This month</option>
                      <option value="days30">Last 30 days</option>
                      <option value="year">This year</option>
                      <option value="all">All time</option>
                    </SelectControl>
                  </label>
                  <label>
                    Entry type
                    <SelectControl
                      aria-label="Journal entry type"
                      value={type}
                      onChange={(event) => setType(event.target.value as typeof type)}
                    >
                      <option value="all">All entries</option>
                      <option value="session">Play sessions</option>
                      <option value="started">Starts</option>
                      <option value="finished">Outcomes</option>
                      <option value="added">Library additions</option>
                    </SelectControl>
                  </label>
                  <label className="activity-search">
                    Game
                    <TextInput
                      aria-label="Find a game in activity"
                      placeholder="Search game titles"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <label>
                    Day
                    <TextInput
                      type="date"
                      aria-label="Journal date"
                      max={today}
                      value={selectedDate ?? ""}
                      onChange={(event) => selectDay(event.target.value || null)}
                    />
                  </label>
                  <Button
                    onClick={() => {
                      setSearch("");
                      setType("all");
                      setSelectedDate(null);
                      setPeriod("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </section>
                <section aria-labelledby="activity-summary-title" className="activity-summary">
                  <h2 id="activity-summary-title">Play summary · {scope}</h2>
                  <div className="activity-metrics">
                    {[
                      { label: "Active play days", value: summary.activeDays },
                      { label: "Play sessions", value: summary.sessions },
                      { label: "Recorded session hours", value: `${summary.hours}h` },
                      { label: "Completed or mastered", value: summary.completed },
                    ].map((metric) => (
                      <article
                        className="activity-surface activity-metric"
                        key={metric.label}
                        aria-label={metric.label}
                      >
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </article>
                    ))}
                  </div>
                  <p className="activity-help">
                    Play summary follows the period and day selection. Hours use recorded session
                    durations.
                    {summary.unknownDuration
                      ? ` ${summary.unknownDuration} ${summary.unknownDuration === 1 ? "session has" : "sessions have"} no duration set.`
                      : ""}
                  </p>
                  {(summary.mostLogged || summary.bestDay) && (
                    <div className="activity-summary-facts">
                      {summary.mostLogged && (
                        <p>
                          Most logged game:{" "}
                          <Link to={`/game/${summary.mostLogged.game.igdbId}`}>
                            {summary.mostLogged.game.title}
                          </Link>{" "}
                          · {summary.mostLogged.sessions}{" "}
                          {summary.mostLogged.sessions === 1 ? "session" : "sessions"}
                        </p>
                      )}
                      {summary.bestDay && (
                        <p>
                          Most active weekday: <strong>{summary.bestDay.label}</strong> ·{" "}
                          {summary.bestDay.days}{" "}
                          {summary.bestDay.days === 1 ? "play day" : "play days"}
                        </p>
                      )}
                    </div>
                  )}
                </section>
                <ContributionHeatmap
                  events={events}
                  selectedDate={selectedDate}
                  onSelectDate={selectDay}
                />
                {memories.length > 0 && (
                  <section className="activity-surface activity-memories" aria-label="On this day">
                    <h2>On this day</h2>
                    <ul>
                      {memories.map((event) => (
                        <li key={event.id}>
                          <time dateTime={event.date}>{activityDateLabel(event.date)}</time>
                          <Link to={`/game/${event.game.igdbId}`}>{event.game.title}</Link>
                          <span>{event.title}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <TimelineFeed events={filtered} onOpenGame={(id) => navigate(`/game/${id}`)} />
              </div>
            ) : (
              <div
                id="activity-achievements-panel"
                role={"tabpanel"}
                aria-labelledby={"activity-achievements-panel-achievements-tab"}
              >
                <AchievementsSection achievements={achievements} />
              </div>
            )}
          </>
        )}
      </div>
      {wrappedOpen && games && logs && (
        <YearInReviewModal
          restoreFocusRef={reviewTrigger}
          games={games}
          logs={logs}
          onClose={() =>
            setSearchParams((previous) => {
              previous.delete("year-in-review");
              return previous;
            })
          }
        />
      )}
    </main>
  );
}
