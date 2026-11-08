import { StatsHighlights } from "./StatsHighlights";
import { PageHeader } from "../../components/ui/PageLayout";
import { SelectControl } from "../../components/ui/Controls";
import { useState, useMemo, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { STATUS_COLORS } from "../../components/ui/";
import { Button } from "../../components/ui/Button";
import { VerticalBarChart, HorizontalBarChart, KPICard } from "./Charts";
import {
  Activity,
  Clock,
  Star,
  Calendar,
  Gamepad2,
  BarChart2,
  Hash,
  Layers,
  Sparkles,
  RefreshCw,
} from "../../components/icons";
import { computeLibraryStatistics, type StatisticsRange } from "../../services/libraryStatistics";
import { computeTasteAggregates } from "../../services/stats";
import { generateTasteInsights } from "../../services/ai";
import { HabitsChart } from "./HabitsChart";

type TimeRange = StatisticsRange;

export function StatsScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const insightRequest = useRef<AbortController | null>(null);
  useEffect(() => () => insightRequest.current?.abort(), []);
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Fetch all games and logs
  const allGames = useLiveQuery(() => db.games.toArray());
  const allLogs = useLiveQuery(() => db.logs.toArray());

  const stats = useMemo(() => {
    if (!allGames || !allLogs) return null;
    const result = computeLibraryStatistics(allGames, allLogs, timeRange);
    return {
      ...result,
      statusChartData: Object.entries(result.statusCounts).map(([label, value]) => ({
        label,
        value,
        color: STATUS_COLORS[label as keyof typeof STATUS_COLORS],
      })),
    };
  }, [allGames, allLogs, timeRange]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerateInsights = async () => {
    if (!allGames || !allLogs || insightsLoading) return;
    const controller = new AbortController();
    insightRequest.current = controller;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const aggregates = computeTasteAggregates(allGames, allLogs);
      const generated = await generateTasteInsights(aggregates, controller.signal);
      if (!controller.signal.aborted) setInsights(generated);
    } catch (err: any) {
      console.error(err);
      if (!controller.signal.aborted)
        setInsightsError(
          err instanceof Error ? err.message : "Could not generate observations. Please try again."
        );
    } finally {
      if (!controller.signal.aborted) setInsightsLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main
      id="main-content"
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
    >
      <PageHeader
        title="Statistics"
        actions={
          <SelectControl
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            aria-label="Time range"
            style={{
              padding: "var(--space-1) 28px var(--space-1) var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: "var(--app-fill)",
              border: "1px solid var(--app-separator)",
              color: "var(--app-label)",
              fontSize: "var(--font-size-base)",
              fontWeight: 500,
              outline: "none",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%238E8E93%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px top 50%",
              backgroundSize: "10px auto",
            }}
          >
            <option value="all">All time</option>
            <option value="year">This year</option>
            <option value="months12">Last 12 months</option>
          </SelectControl>
        }
      />

      {/* Body */}
      <div
        className="statistics-content"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {!stats ? (
          <p
            style={{
              color: "var(--app-tertiary-label)",
              fontSize: "var(--font-size-base)",
              textAlign: "center",
            }}
          >
            Loading…
          </p>
        ) : stats.totalGames === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 300,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-xl)",
                background: "var(--app-fill)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Activity size={20} color="var(--app-tertiary-label)" aria-hidden="true" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <p
                style={{
                  color: "var(--app-label)",
                  fontSize: "var(--font-size-base)",
                  fontWeight: 500,
                }}
              >
                Nothing to chart yet
              </p>
              <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-sm)" }}>
                Add some games to your library to see your stats.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Taste Insights */}
            <div
              style={{
                background: "var(--app-secondary-bg)",
                border: "1px solid var(--app-separator)",
                borderRadius: "var(--radius-2xl)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-5) var(--space-8)",
                  borderBottom: insights.length > 0 ? "1px solid var(--app-separator)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--app-accent)",
                      color: "white",
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2
                      style={{
                        fontFamily: "var(--app-font-display)",
                        fontSize: "var(--font-size-lg)",
                        fontWeight: 600,
                        color: "var(--app-label)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Taste Insights
                    </h2>
                    <p
                      style={{
                        fontSize: "var(--font-size-base)",
                        color: "var(--app-tertiary-label)",
                        marginTop: 2,
                      }}
                    >
                      All-time observations from your ratings and recorded outcomes. Only aggregate
                      statistics are sent to Gemini.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateInsights}
                  loading={insightsLoading}
                >
                  {insightsLoading ? (
                    "Analyzing…"
                  ) : insights.length > 0 ? (
                    <>
                      <RefreshCw size={14} /> Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Generate
                    </>
                  )}
                </Button>
              </div>

              {insightsError && (
                <div
                  role="alert"
                  style={{
                    padding: "var(--space-4) var(--space-6)",
                    color: "var(--app-red)",
                    fontSize: "var(--font-size-base)",
                    background: "rgba(255,59,48,0.1)",
                  }}
                >
                  {insightsError}
                </div>
              )}

              {insights.length > 0 && !insightsLoading && (
                <ul
                  style={{
                    padding: "var(--space-4) var(--space-6)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    margin: 0,
                    listStyle: "none",
                  }}
                >
                  {insights.map((insight, idx) => (
                    <li
                      key={idx}
                      style={{
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--app-secondary-label)",
                        paddingLeft: 14,
                        position: "relative",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "0.55em",
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "var(--app-separator)",
                          display: "inline-block",
                        }}
                      />
                      {insight}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Play habits & Streaks */}
            <ChartSection title="Play habits" icon={<Calendar size={16} aria-hidden="true" />}>
              <HabitsChart logs={allLogs ?? []} />
            </ChartSection>

            <p role="status" style={{ color: "var(--app-secondary-label)", margin: 0 }}>
              {timeRange === "all"
                ? "Ratings, recorded hours, genres and personal platforms cover all library games."
                : `${stats.selectedGames} games marked Played with a finish date in this period. Ratings, genres and platforms refer to these games. Hours are their lifetime recorded totals, not hours played during this period.`}{" "}
              Library totals, status, taste observations and play habits keep their own stated
              scope.
            </p>
            {/* KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 20,
              }}
            >
              <KPICard
                label="Total games · all time"
                value={stats.totalGames}
                icon={<Hash size={14} aria-hidden="true" />}
              />
              <KPICard
                label={timeRange === "all" ? "Recorded hours" : "Recorded hours · selected games"}
                value={stats.hoursPlayed}
                icon={<Clock size={14} aria-hidden="true" />}
              />
              <KPICard
                label="Average rating · selected games"
                value={stats.avgRating}
                icon={<Star size={14} aria-hidden="true" />}
              />
              <KPICard
                label="Played this year"
                value={stats.playedThisYear}
                icon={<Calendar size={14} aria-hidden="true" />}
              />
            </div>

            <StatsHighlights
              highlights={stats.highlights}
              range={timeRange}
              backlogCount={stats.statusCounts.Backlog}
            />

            {/* Charts Row 1 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                gap: 20,
              }}
            >
              <ChartSection
                title="Rating distribution"
                icon={<BarChart2 size={16} aria-hidden="true" />}
              >
                <VerticalBarChart
                  data={stats.ratingChartData}
                  height={180}
                  caption="Rating distribution"
                  labelUnit=" stars"
                />
              </ChartSection>

              <ChartSection
                title="Recorded platforms"
                icon={<Gamepad2 size={16} aria-hidden="true" />}
              >
                <HorizontalBarChart data={stats.platformChartData} caption="Recorded platforms" />
              </ChartSection>
            </div>

            {/* Charts Row 2 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                gap: 20,
              }}
            >
              <ChartSection title="Top genres" icon={<Layers size={16} aria-hidden="true" />}>
                <HorizontalBarChart data={stats.genreChartData} caption="Top genres" />
              </ChartSection>

              <ChartSection
                title="Library by status · all time"
                icon={<Activity size={16} aria-hidden="true" />}
              >
                <HorizontalBarChart
                  data={stats.statusChartData}
                  caption="Library by status · all time"
                />
              </ChartSection>
            </div>

            {/* Charts Row 3 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
              <ChartSection
                title="Recorded finishes · last 12 months"
                icon={<BarChart2 size={16} aria-hidden="true" />}
              >
                <p style={{ color: "var(--app-secondary-label)", fontSize: 13 }}>
                  Games currently marked Played, grouped by their recorded finish date. This is not
                  a history of backlog changes.
                </p>
                <VerticalBarChart
                  data={stats.finishesByMonth}
                  height={180}
                  color="var(--app-blue)"
                  caption="Recorded finishes · last 12 months"
                />
              </ChartSection>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function ChartSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "var(--space-6)",
        background: "var(--app-secondary-bg)",
        border: "1px solid var(--app-separator)",
        borderRadius: "var(--radius-2xl)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--app-tertiary-label)" }}>{icon}</span>
        <h2
          style={{
            fontFamily: "var(--app-font-display)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--app-label)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
      </div>
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      >
        {children}
      </div>
    </div>
  );
}
