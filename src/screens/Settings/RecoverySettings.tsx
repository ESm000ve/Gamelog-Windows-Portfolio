import { Surface } from "../../components/ui/PageLayout";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { RecoveryRepo } from "../../db/repositories/RecoveryRepo";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { OperationFeedback } from "../../components/ui/Feedback";
import { operationError } from "../../services/feedback";
import type { RecoveryEntry } from "../../types/recovery";
export function RecoverySettings() {
  const entries = useLiveQuery(() => db.removals.orderBy("removedAt").reverse().toArray());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [limit, setLimit] = useState(10);
  const [discard, setDiscard] = useState<RecoveryEntry | null>(null);
  const [confirm, setConfirm] = useState<RecoveryEntry | null>(null);
  const section = useRef<HTMLElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#recently-removed" && entries !== undefined)
      section.current?.scrollIntoView({ block: "start" });
  }, [location.hash, entries?.length]);
  const restore = async (entry: RecoveryEntry) => {
    if (busy) return;
    setBusy(entry.id);
    setError("");
    setMessage("");
    try {
      await RecoveryRepo.restore(entry.id);
      setConfirm(null);
      setMessage(
        entry.kind === "library"
          ? "Library restored. Your newer library was kept as another recovery point."
          : `${entry.label} restored.`
      );
    } catch (error) {
      setError(operationError(error, "Could not restore this item. Please try again."));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Surface
      id="recently-removed"
      ref={section}
      className="settings-card"
      style={{ scrollMarginTop: 24 }}
    >
      <div className="settings-card-header">
        <h2>Recently removed</h2>
      </div>
      <p className="settings-card-description">
        Restore removed games, lists, list entries and edited session histories, or return to your
        library before a backup import. Recovery copies stay on this device until restored or
        explicitly deleted.
      </p>
      <OperationFeedback
        error={error}
        busy={entries === undefined || Boolean(busy)}
        message={
          entries === undefined
            ? "Loading recovery copies..."
            : busy
              ? "Updating recovery copies..."
              : message
        }
      />
      {entries?.length === 0 && (
        <p style={{ color: "var(--app-secondary-label)" }}>No removed items.</p>
      )}
      {entries?.slice(0, limit).map((entry) => (
        <div
          key={entry.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 0",
            borderBottom: "1px solid var(--app-separator)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>{entry.label}</strong>
            <p style={{ fontSize: 12, color: "var(--app-secondary-label)", marginTop: 4 }}>
              {entry.kind === "game"
                ? "Game and personal log"
                : entry.kind === "list"
                  ? "List"
                  : entry.kind === "list-item"
                    ? `Removed from ${entry.listName}`
                    : entry.kind === "sessions"
                      ? "Session history before editing"
                      : "Library recovery point"}{" "}
              &middot; {new Date(entry.removedAt).toLocaleString()}
            </p>
          </div>
          <Button
            aria-label={
              entry.kind === "list-item"
                ? `Restore ${entry.label} to ${entry.listName}`
                : `Restore ${entry.label}`
            }
            disabled={Boolean(busy)}
            loading={busy === entry.id}
            onClick={() => (entry.kind === "library" ? setConfirm(entry) : void restore(entry))}
          >
            Restore
          </Button>
          <Button
            variant="ghost"
            disabled={Boolean(busy)}
            aria-label={`Delete recovery copy of ${entry.label}`}
            onClick={() => {
              setError("");
              setDiscard(entry);
            }}
          >
            Delete copy
          </Button>
        </div>
      ))}
      {(entries?.length ?? 0) > limit && (
        <Button style={{ marginTop: 16 }} onClick={() => setLimit((value) => value + 10)}>
          Show more
        </Button>
      )}
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title="Restore this library?"
        confirmLabel="Restore library"
        busy={Boolean(busy)}
        error={error}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void restore(confirm);
        }}
      >
        This replaces the active games, logs, lists, and tags with this recovery point. Your current
        library will be kept as another recovery point.
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={Boolean(discard)}
        title="Delete this recovery copy permanently?"
        confirmLabel="Delete permanently"
        danger
        busy={Boolean(busy)}
        error={error}
        onClose={() => setDiscard(null)}
        onConfirm={async () => {
          if (!discard || busy) return;
          setBusy(discard.id);
          setError("");
          try {
            await RecoveryRepo.forget(discard.id);
            setDiscard(null);
            setMessage("Recovery copy deleted. Your active library was not changed.");
          } catch (error) {
            setError(operationError(error, "Could not delete this copy. Please try again."));
          } finally {
            setBusy(null);
          }
        }}
      >
        Only this saved copy will be deleted. Your active library will not change. This cannot be
        undone.
      </ConfirmDialog>
    </Surface>
  );
}
