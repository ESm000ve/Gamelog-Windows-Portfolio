import { computePlayHabits } from "../../services/playHabits";
import { useMemo } from "react";
import type { Log } from "../../types";

interface HabitsChartProps {
  logs: Log[];
}

export function HabitsChart({ logs }: HabitsChartProps) {
  const { maxStreak, currentStreak, heatmapData } = useMemo(() => computePlayHabits(logs), [logs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 24,
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--app-separator)",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--app-tertiary-label)",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            Current streak
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--app-label)",
              fontFamily: "var(--app-font-display)",
            }}
          >
            {currentStreak}{" "}
            <span
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 500,
                color: "var(--app-secondary-label)",
              }}
            >
              days
            </span>
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--app-tertiary-label)",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            Longest streak
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--app-label)",
              fontFamily: "var(--app-font-display)",
            }}
          >
            {maxStreak}{" "}
            <span
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 500,
                color: "var(--app-secondary-label)",
              }}
            >
              days
            </span>
          </p>
        </div>
      </div>

      <div>
        <p style={{ color: "var(--app-secondary-label)", fontSize: 13 }}>
          Streaks count explicitly logged sessions. Total playtime alone does not record daily
          activity.
        </p>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--app-tertiary-label)",
            marginBottom: "var(--space-2)",
          }}
        >
          Recorded play sessions (last 365 days)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(53, 1fr)", gap: 4 }}>
          {Array.from({ length: 53 }).map((_, colIdx) => (
            <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.from({ length: 7 }).map((_, rowIdx) => {
                const dayIdx = colIdx * 7 + rowIdx;
                if (dayIdx >= heatmapData.length) return <div key={rowIdx} />;
                const data = heatmapData[dayIdx];
                return (
                  <div
                    key={rowIdx}
                    title={`${data.date}: ${data.played ? "session recorded" : "no session recorded"}`}
                    style={{
                      width: "100%",
                      aspectRatio: "1/1",
                      borderRadius: 2,
                      background: data.played ? "var(--app-accent)" : "var(--app-fill)",
                      opacity: data.played ? 1 : 0.5,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
