import { useRef, useState, type RefObject } from "react";
import type { Log } from "../../types";
import { saveSessionHistory } from "../../services/sessionHistory";
import { localDate } from "../../utils/dates";
import { notifyRemoval } from "../../services/feedback";
import { Modal } from "../ui/Modal";
import { TextInput } from "../ui/Controls";
import { Button } from "../ui/Button";
import "./LibraryAssistant.css";
import "./CollectionTools.css";
type Row = { id: string; date: string; minutes: string };
export function SessionHistoryDialog({
  igdbId,
  title,
  log,
  onClose,
  restoreFocusRef,
}: {
  igdbId: number;
  title: string;
  log: Log;
  onClose: () => void;
  restoreFocusRef: RefObject<HTMLElement | null>;
}) {
  const expected = useRef({
    createdAt: log.createdAt,
    sessions: structuredClone(log.playSessions ?? []),
  });
  const [rows, setRows] = useState<Row[]>(() =>
    (log.playSessions ?? []).map((s) => ({
      id: crypto.randomUUID(),
      date: s.date,
      minutes: s.durationMinutes === undefined ? "" : String(s.durationMinutes),
    }))
  );
  const [removed, setRemoved] = useState<{ row: Row; index: number } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const add = useRef<HTMLButtonElement>(null);
  const change = (id: string, update: Partial<Row>) => {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...update } : r)));
    setError("");
  };
  const sessions = rows.map((r) => ({
    date: r.date,
    ...(r.minutes.trim() ? { durationMinutes: Number(r.minutes) } : {}),
  }));
  const dirty = JSON.stringify(sessions) !== JSON.stringify(expected.current.sessions);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await saveSessionHistory(
        igdbId,
        rows.map((r) => ({
          date: r.date,
          ...(r.minutes.trim() ? { durationMinutes: Number(r.minutes) } : {}),
        })),
        expected.current
      );
      notifyRemoval("Session history saved", id);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save session history. Your draft was kept."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      title={`Session history: ${title}`}
      onClose={onClose}
      busy={busy}
      initialFocusRef={add}
      restoreFocusRef={restoreFocusRef}
      width={700}
    >
      <div className="assistant-dialog-body">
        <p className="assistant-help">
          Review or correct dated sessions. Minutes are optional and feed session-based statistics.
          Your lifetime playtime total stays unchanged. Older quick logs may contain an automatic
          60-minute value; review those before changing them.
        </p>
        <Button
          ref={add}
          disabled={busy}
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: crypto.randomUUID(), date: localDate(), minutes: "" },
            ])
          }
        >
          Add session
        </Button>
        {rows.length === 0 && <p>No sessions recorded. Add a date to start tracking activity.</p>}
        {rows.map((row, index) => (
          <div className="session-history-row" key={row.id}>
            <label>
              Date
              <TextInput
                type="date"
                aria-label={`Session ${index + 1} date`}
                value={row.date}
                max={localDate()}
                disabled={busy}
                onChange={(e) => change(row.id, { date: e.target.value })}
              />
            </label>
            <label>
              Minutes (optional)
              <TextInput
                type="number"
                min={0}
                max={1440}
                step="any"
                aria-label={`Session ${index + 1} minutes`}
                value={row.minutes}
                disabled={busy}
                onChange={(e) => change(row.id, { minutes: e.target.value })}
              />
            </label>
            <Button
              disabled={busy}
              aria-label={`Remove session ${index + 1}`}
              onClick={() => {
                setRemoved({ row, index });
                setRows((current) => current.filter((r) => r.id !== row.id));
                add.current?.focus();
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        {removed && (
          <Button
            disabled={busy}
            onClick={() => {
              setRows((current) => {
                const next = [...current];
                next.splice(Math.min(removed.index, next.length), 0, removed.row);
                return next;
              });
              setRemoved(null);
              add.current?.focus();
            }}
          >
            Undo last removal
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="assistant-dialog-footer">
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty} loading={busy} onClick={() => void save()}>
          Save history
        </Button>
      </div>
    </Modal>
  );
}
