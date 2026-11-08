import type { Status, Completion } from "../../types";
import "./StatusChip.css";

// ─── Status → color mapping ───────────────────────────────────────────────────
// Status and Completion are distinct taxonomies (see types/index.ts) — they get
// their own color maps so each value stays visually distinguishable.

export const STATUS_COLORS: Record<Status, string> = {
  Wishlist: "var(--app-pink)",
  Backlog: "var(--app-blue)",
  Playing: "var(--app-green)",
  Played: "var(--app-orange)",
};

export const STATUS_SUBTLE: Record<Status, string> = {
  Wishlist: "var(--app-pink-subtle)",
  Backlog: "var(--app-blue-subtle)",
  Playing: "var(--app-green-subtle)",
  Played: "var(--app-orange-subtle)",
};

// ─── Completion → color mapping ───────────────────────────────────────────────

export const COMPLETION_COLORS: Record<Completion, string> = {
  Completed: "var(--app-green)",
  Mastered: "var(--app-yellow)",
  Abandoned: "var(--app-red)",
  Shelved: "var(--app-purple)",
};

export const COMPLETION_SUBTLE: Record<Completion, string> = {
  Completed: "var(--app-green-subtle)",
  Mastered: "var(--app-yellow-subtle)",
  Abandoned: "var(--app-red-subtle)",
  Shelved: "var(--app-purple-subtle)",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface StatusChipProps {
  label: Status | "All";
  count?: number;
  active: boolean;
  /** Dot color — omit to suppress the dot (e.g. "All" filter) */
  dotColor?: string;
  onClick: () => void;
  /** Suppress the numeric count (standalone label use) */
  hideCount?: boolean;
  /** Compact mode — less horizontal padding */
  compact?: boolean;
}

export function StatusChip({
  label,
  count,
  active,
  dotColor,
  onClick,
  hideCount = false,
  compact = false,
}: StatusChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`status-chip ${active ? "active" : ""} ${compact ? "compact" : ""}`}
    >
      {dotColor && (
        <span aria-hidden="true" className="status-chip-dot" style={{ background: dotColor }} />
      )}
      {label}
      {!hideCount && count !== undefined && <span className="status-chip-count">{count}</span>}
    </button>
  );
}
