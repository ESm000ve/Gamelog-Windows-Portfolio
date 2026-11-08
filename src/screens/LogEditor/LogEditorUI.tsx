import { AlertCircle } from "../../components/icons";
import { Button } from "../../components/ui/Button";

export function Field({
  label,
  error,
  htmlFor,
  id,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      {htmlFor ? (
        <label
          htmlFor={htmlFor}
          style={{
            display: "block",
            fontSize: "var(--font-size-sm)",
            fontWeight: 500,
            color: "var(--app-tertiary-label)",
            textTransform: "none",
            letterSpacing: "normal",
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      ) : (
        <span
          id={id ? `${id}-label` : undefined}
          style={{
            display: "block",
            fontSize: "var(--font-size-sm)",
            fontWeight: 500,
            color: "var(--app-tertiary-label)",
            textTransform: "none",
            letterSpacing: "normal",
            marginBottom: 6,
          }}
        >
          {label}
        </span>
      )}
      {children}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: "var(--space-1)",
            fontSize: "var(--font-size-sm)",
            color: "var(--app-red)",
          }}
        >
          <AlertCircle size={11} />
          {error}
        </div>
      )}
    </div>
  );
}

export function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      aria-pressed={active}
      type="button"
      style={{
        padding: "6px var(--space-3)",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--font-size-sm)",
        minHeight: 44,
        fontWeight: active ? 600 : 400,
        background: active ? "var(--app-accent)" : "var(--app-fill)",
        color: active ? "var(--app-accent-foreground)" : "var(--app-secondary-label)",
        border: `1px solid ${active ? "var(--app-accent)" : "var(--app-separator)"}`,
        transition: "background 120ms ease, color 120ms ease",
        textAlign: "center",
      }}
    >
      {label}
    </Button>
  );
}
