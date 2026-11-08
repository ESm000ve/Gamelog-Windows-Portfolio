import { useEffect, useRef, useState, useId, type RefObject } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextArea, CheckControl } from "../ui/Controls";
import { OperationFeedback } from "../ui/Feedback";
import { generateResumeRecap, saveResumeRecap, type RecapDraft } from "../../services/resumeRecap";
import { readSavedRecap } from "../../services/recapContracts";
import "./LibraryAssistant.css";
export function ResumeRecapDialog({
  igdbId,
  title,
  onClose,
  restoreFocusRef,
}: {
  igdbId: number;
  title: string;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const log = useLiveQuery(() => db.logs.get(igdbId), [igdbId]);
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<RecapDraft | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const baseline = useRef({ notes: "", createdAt: 0 });
  const task = useRef<AbortController | null>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const sourcePrefix = useId();
  useEffect(() => () => task.current?.abort(), []);
  useEffect(() => {
    if (log && !loaded) {
      setNotes(log.notes ?? "");
      setLoaded(true);
    }
  }, [log, loaded]);
  const saved = readSavedRecap(log?.resumeRecap);
  const display = draft ?? saved;
  async function generate() {
    if (!log || busy || saving || !consent) return;
    const request = new AbortController();
    task.current = request;
    baseline.current = { notes: log.notes ?? "", createdAt: log.createdAt };
    setBusy(true);
    setError("");
    setMessage("");
    setDraft(null);
    try {
      const result = await generateResumeRecap(title, notes, consent, request.signal);
      if (!request.signal.aborted) setDraft(result);
    } catch (error) {
      if (!request.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Could not generate a recap. Your notes were not changed."
        );
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveResumeRecap(igdbId, draft, baseline.current);
      setDraft(null);
      setMessage("Recap saved separately. Your original notes were not changed.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save this recap. The draft was kept."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={`Resume recap: ${title}`}
      isOpen
      onClose={onClose}
      busy={saving}
      initialFocusRef={input}
      restoreFocusRef={restoreFocusRef}
      width={680}
    >
      <div className="assistant-dialog-body">
        <p className="assistant-help">
          Choose the note excerpts to summarize. Generating sends only the game title and the text
          below to Gemini. No other stored notes, catalog plot details or play history are included.
          Review the result before saving it separately from your notes.
        </p>
        <label>
          Selected note excerpts
          <TextArea
            ref={input}
            aria-label="Selected note excerpts"
            rows={7}
            value={notes}
            disabled={saving}
            onChange={(event) => {
              task.current?.abort();
              setBusy(false);
              setNotes(event.target.value);
              setConsent(false);
              setDraft(null);
              setError("");
              setMessage("");
            }}
          />
        </label>
        {!notes.trim() && (
          <p className="assistant-help">
            No note excerpts selected. Add notes to your log, or enter the excerpts you want to use
            here.
          </p>
        )}
        <CheckControl
          label="Allow this selected text to be sent to Gemini for this recap."
          ariaLabel="Allow selected excerpts to be sent to Gemini"
          checked={consent}
          disabled={saving || busy}
          onChange={setConsent}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            disabled={!log || !notes.trim() || !consent || saving}
            loading={busy}
            onClick={generate}
          >
            Generate recap
          </Button>
          {busy && (
            <Button
              onClick={() => {
                task.current?.abort();
                setBusy(false);
                setMessage("Generation stopped. Your notes were not changed.");
              }}
            >
              Stop
            </Button>
          )}
        </div>
        <OperationFeedback error={error} message={message} />
        {saved && !draft && (
          <p className="assistant-help">
            Saved recap
            {saved.sourceLogUpdatedAt !== log?.updatedAt
              ? ". Your log has changed since it was saved; review its source excerpts before relying on it."
              : ". Generate a new draft only if you want to replace it."}
          </p>
        )}
        {display && (
          <section className="recap-result" aria-label={draft ? "Recap draft" : "Saved recap"}>
            <h3>{draft ? "Review recap draft" : "Saved recap"}</h3>
            <p className="assistant-help">
              AI can make mistakes. Each reference links to the excerpts used; check that the
              reminder is supported.
            </p>
            <ul>
              {display.bullets.map((bullet, index) => (
                <li key={index}>
                  {bullet.text}{" "}
                  {bullet.sourceIds.map((id) => (
                    <a key={id} href={`#${sourcePrefix}-source-${id}`}>
                      [Source {id}]{" "}
                    </a>
                  ))}
                </li>
              ))}
            </ul>
            <details open className="recap-sources">
              <summary>Source excerpts ({display.sources.length})</summary>
              {display.sources.map((source) => (
                <p id={`${sourcePrefix}-source-${source.id}`} key={source.id}>
                  <strong>Source {source.id}:</strong> {source.text}
                </p>
              ))}
            </details>
          </section>
        )}
      </div>
      <div className="assistant-dialog-footer">
        <Button disabled={saving} onClick={onClose}>
          Close
        </Button>
        {draft && (
          <Button variant="primary" loading={saving} onClick={save}>
            {saved ? "Replace saved recap" : "Save recap"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
