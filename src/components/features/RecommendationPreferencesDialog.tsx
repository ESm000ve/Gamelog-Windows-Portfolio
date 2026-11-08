import { useState, useRef, type RefObject } from "react";
import {
  clearRecommendationFeedback,
  type RecommendationFeedback,
} from "../../services/recommendationFeedback";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import "./LibraryAssistant.css";
export function RecommendationPreferencesDialog({
  feedback,
  onChange,
  onClose,
  restoreFocusRef,
}: {
  feedback: RecommendationFeedback[];
  onChange: (next: RecommendationFeedback[]) => void;
  onClose: () => void;
  restoreFocusRef: RefObject<HTMLElement | null>;
}) {
  const [error, setError] = useState("");
  const close = useRef<HTMLButtonElement>(null);
  function clear(id?: number) {
    try {
      onChange(clearRecommendationFeedback(id));
      setError("");
      close.current?.focus();
    } catch {
      setError("Could not update preferences. Please try again.");
    }
  }
  return (
    <Modal
      isOpen
      title="Recommendation preferences"
      onClose={onClose}
      restoreFocusRef={restoreFocusRef}
      width={600}
    >
      <div className="assistant-dialog-body">
        <p className="assistant-help">
          Less like this hides that game from recommendation picks and modestly lowers games sharing
          its genres. Explicit requests can still favor those genres. Skip is temporary. These
          preferences stay on this device, are not included in library backups, and are not sent to
          AI. Your library is unchanged.
        </p>
        {feedback.length === 0 && (
          <p>No games hidden. Use Less like this on a recommendation to refine future picks.</p>
        )}
        <ul className="assistant-preview">
          {feedback.map((entry) => (
            <li key={entry.igdbId}>
              <strong>{entry.title}</strong>
              <span>{entry.genres.join(", ") || "No recorded genres"}</span>
              <Button aria-label={`Show ${entry.title} again`} onClick={() => clear(entry.igdbId)}>
                Show again
              </Button>
            </li>
          ))}
        </ul>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="assistant-dialog-footer">
        <Button disabled={!feedback.length} onClick={() => clear()}>
          Reset preferences
        </Button>
        <Button ref={close} onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
