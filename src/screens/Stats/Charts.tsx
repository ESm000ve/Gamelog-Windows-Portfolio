import type { ReactNode } from "react";

// ─── Vertical Bar Chart (Rating Distribution) ─────────────────────────────────

export interface VerticalBarProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  caption?: string;
  labelUnit?: string;
}

export function VerticalBarChart({
  data,
  color = "var(--app-yellow)",
  height = 150,
  caption = "Chart data",
  labelUnit = "",
}: VerticalBarProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1); // Avoid div by 0

  return (
    <figure style={{ margin: 0 }}>
      {/* Visually hidden data table for screen readers */}
      <table
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <caption>{caption}</caption>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx}>
              <th scope="row">
                {item.label}
                {labelUnit}
              </th>
              <td>{item.value} games</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual chart (hidden from SR) */}
      <div
        aria-hidden="true"
        style={{ display: "flex", alignItems: "flex-end", height, gap: 4, width: "100%" }}
      >
        {data.map((item, idx) => {
          const pct = (item.value / maxVal) * 100;
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: "100%",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
              title={`${item.label}${labelUnit}: ${item.value} games`}
            >
              {/* Bar container */}
              <div
                style={{
                  flex: 1,
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  background: "rgba(0,0,0,0.05)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${pct}%`,
                    background: color,
                    transition: "height 300ms ease",
                    borderRadius: "var(--radius-sm)",
                    opacity: item.value > 0 ? 1 : 0,
                  }}
                />
              </div>
              {/* Label */}
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--app-tertiary-label)",
                  fontWeight: 500,
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// ─── Horizontal Bar Chart (By Platform, Genres, Status) ───────────────────────

export interface HorizontalBarItem {
  label: string;
  value: number;
  color?: string; // Optional custom color per bar
}

export interface HorizontalBarProps {
  data: HorizontalBarItem[];
  color?: string; // Default color if item doesn't have one
  caption?: string;
}

export function HorizontalBarChart({
  data,
  color = "var(--app-accent)",
  caption = "Chart data",
}: HorizontalBarProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <div style={{ padding: "var(--space-5) 0", textAlign: "center" }}>
        <p style={{ color: "var(--app-tertiary-label)", fontSize: "var(--font-size-base)" }}>
          No data in this period.
        </p>
      </div>
    );
  }

  return (
    <figure style={{ margin: 0 }}>
      {/* Visually hidden data table for screen readers */}
      <table
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <caption>{caption}</caption>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx}>
              <th scope="row">{item.label}</th>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual chart (hidden from SR) */}
      <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map((item, idx) => {
          const pct = (item.value / maxVal) * 100;
          const barColor = item.color || color;

          return (
            <div
              key={idx}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
              title={`${item.label}: ${item.value}`}
            >
              <div style={{ flexShrink: 0, width: 80, textAlign: "right" }}>
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                    color: "var(--app-secondary-label)",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  height: 24,
                  background: "rgba(0,0,0,0.05)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: barColor,
                    transition: "width 300ms ease",
                    borderRadius: "var(--radius-sm)",
                    opacity: item.value > 0 ? 1 : 0,
                  }}
                />
              </div>

              <div style={{ flexShrink: 0, width: 30, textAlign: "left" }}>
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--app-label)",
                  }}
                >
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export function KPICard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "var(--space-4) var(--space-5)",
        background: "var(--app-secondary-bg)",
        border: "1px solid var(--app-separator)",
        borderRadius: "var(--radius-2xl)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon && (
          <span aria-hidden="true" style={{ color: "var(--app-tertiary-label)", display: "flex" }}>
            {icon}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--app-tertiary-label)" }}>
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--app-font-display)",
          fontSize: 24,
          fontWeight: 700,
          color: "var(--app-label)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}
