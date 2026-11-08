import { useEffect, useRef, useState } from "react";
import { Surface } from "../../components/ui/PageLayout";
import { Button } from "../../components/ui/Button";
import { OperationFeedback } from "../../components/ui/Feedback";
import { prepareGameMatches } from "../../services/gameSimilarity";
export function AISettings() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function prepare() {
    if (busy) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress(0);
    try {
      const count = await prepareGameMatches((done, total) => {
        setProgress(total ? (100 * done) / total : 100);
        setMessage(`Prepared ${done} of ${total} game matches.`);
      }, request.signal);
      setMessage(
        count
          ? `Prepared ${count} game matches. They are saved on this device.`
          : "All current game matches are ready."
      );
    } catch (error) {
      setMessage(request.signal.aborted ? "Stopped. Completed game matches were kept." : "");
      if (!request.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Could not prepare matches. Please try again."
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Surface className="settings-card">
      <div className="settings-card-header">
        <h2>AI assistance</h2>
      </div>
      <p className="settings-card-description">
        Local recommendations work without AI. Get picks can ask Gemini to refine eligible games;
        quick log turns a sentence into a draft, and taste observations use aggregate statistics.
        Ask library and list drafts interpret only the request you submit. Resume recaps send only
        the note excerpts you explicitly choose to share; consent is required before each edited
        selection is sent. Other stored notes are not included.
      </p>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Deeper game matches</h3>
      <p className="settings-card-description">
        Optionally send game titles, genres and catalog descriptions to Gemini to prepare similarity
        matches. This uses your configured API quota. Matches are saved locally; new games can be
        prepared later. Basic genre matching works without this step.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={prepare} loading={busy}>
          Prepare game matches
        </Button>
        {busy && <Button onClick={() => controller.current?.abort()}>Stop</Button>}
      </div>
      <OperationFeedback
        busy={busy}
        progress={progress}
        message={busy ? message : undefined}
        error={error}
      />
      {!busy && message && (
        <p role="status" style={{ marginTop: 12, color: "var(--app-secondary-label)" }}>
          {message}
        </p>
      )}
    </Surface>
  );
}
