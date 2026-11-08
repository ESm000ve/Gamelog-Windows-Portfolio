import { TextInput } from "../../components/ui/Controls";
import type { FormState } from "./index";
import { STATUS_COLORS } from "../../components/ui/";
import { StarRatingInput, StarRating } from "../../components/ui/";
import { Button } from "../../components/ui/Button";
import type { Status, Completion } from "../../types";
import { Field, PillButton } from "./LogEditorUI";

const STATUSES: Status[] = ["Wishlist", "Backlog", "Playing", "Played"];
const COMPLETIONS: Completion[] = ["Completed", "Mastered", "Abandoned", "Shelved"];

interface LogEditorStatusProps {
  status: Status;
  completion?: Completion;
  completionPercentage?: number;
  rating?: number;
  onSet: (key: keyof FormState, val: any) => void;
}

export function LogEditorStatus({
  status,
  completion,
  completionPercentage,
  rating,
  onSet,
}: LogEditorStatusProps) {
  const togglePill = <T,>(current: T | undefined, val: T, setVal: (v: T | undefined) => void) => {
    if (current === val) setVal(undefined);
    else setVal(val);
  };

  return (
    <>
      {/* ── Status ── */}
      <Field label="Status" id="status-group">
        <div
          role="group"
          aria-labelledby="status-group-label"
          style={{
            display: "flex",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--app-separator)",
          }}
        >
          {STATUSES.map((s) => {
            const active = status === s;
            return (
              <Button
                key={s}
                type="button"
                onClick={() => onSet("status", s)}
                aria-pressed={active}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: active ? 600 : 400,
                  background: active ? STATUS_COLORS[s] + "25" : "transparent",
                  color: active ? STATUS_COLORS[s] : "var(--app-secondary-label)",
                  borderRight: s !== "Played" ? "1px solid var(--app-separator)" : "none",
                  transition: "background 120ms ease, color 120ms ease",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                {s}
              </Button>
            );
          })}
        </div>
      </Field>

      {/* ── Completion (Played only) ── */}
      {status === "Played" && (
        <Field label="Completion" id="completion-group">
          <div
            role="group"
            aria-labelledby="completion-group-label"
            style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          >
            {COMPLETIONS.map((c) => (
              <PillButton
                key={c}
                label={c}
                active={completion === c}
                onClick={() => togglePill(completion, c, (v) => onSet("completion", v))}
              />
            ))}
          </div>
        </Field>
      )}

      {/* ── Completion Percentage (Playing or Played) ── */}
      {(status === "Playing" || status === "Played") && (
        <Field label="Progress" id="progress-group">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <TextInput
              type="range"
              min="0"
              max="100"
              step="1"
              value={completionPercentage ?? 0}
              onChange={(e) => onSet("completionPercentage", parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: "var(--app-accent)" }}
            />
            <span
              style={{
                fontSize: "var(--font-size-base)",
                color: "var(--app-label)",
                minWidth: 40,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {completionPercentage ?? 0}%
            </span>
          </div>
        </Field>
      )}

      {/* ── Rating ── */}
      <Field label="Rating">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StarRatingInput value={rating ?? 0} onChange={(v) => onSet("rating", v)} size={24} />
          {rating !== undefined && (
            <>
              <StarRating rating={rating} size={12} showValue />
              <Button
                type="button"
                onClick={() => onSet("rating", undefined)}
                aria-label="Clear rating"
                style={{
                  fontSize: 11,
                  color: "var(--app-tertiary-label)",
                  textDecoration: "underline",
                }}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </Field>
    </>
  );
}
