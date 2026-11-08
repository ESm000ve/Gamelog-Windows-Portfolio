import { useRef, useState, type RefObject } from "react";
import {
  readSavedViews,
  describeSavedView,
  storeView,
  removeView,
  restoreView,
  type SavedLibraryView,
} from "../../services/savedViews";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/Controls";
import "./LibraryAssistant.css";
import "./CollectionTools.css";
export function SavedViewsDialog({
  current,
  onApply,
  onClose,
  restoreFocusRef,
}: {
  current: Omit<SavedLibraryView, "id" | "name">;
  onApply: (view: SavedLibraryView) => void;
  onClose: () => void;
  restoreFocusRef: RefObject<HTMLElement | null>;
}) {
  const [views, setViews] = useState(readSavedViews),
    [name, setName] = useState("");
  const [removed, setRemoved] = useState<SavedLibraryView | null>(null),
    [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  function run(action: () => void) {
    try {
      action();
      setViews(readSavedViews());
      setError("");
      input.current?.focus();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update saved views.");
    }
  }
  return (
    <Modal
      isOpen
      title="Saved library views"
      onClose={onClose}
      initialFocusRef={input}
      restoreFocusRef={restoreFocusRef}
      width={640}
    >
      <div className="assistant-dialog-body">
        <p className="assistant-help">
          Save the current title search, filters, sort and layout. Applying a view runs those
          criteria against your latest library. Views stay on this device and are not included in
          JSON library backups. No AI request is made.
        </p>
        <form
          className="assistant-request"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => {
              storeView({ ...current, name });
              setName("");
              setMessage("View saved.");
            });
          }}
        >
          <label>
            View name
            <TextInput
              ref={input}
              aria-label="View name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Save current view
          </Button>
        </form>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {views.length === 0 && <p>No saved views yet.</p>}
        <ul className="assistant-preview">
          {views.map((view) => (
            <li key={view.id}>
              <strong>{view.name}</strong>
              <span>{describeSavedView(view)}</span>
              <div className="collection-tool-actions">
                <Button
                  aria-label={`Apply view ${view.name}`}
                  onClick={() => {
                    onApply(view);
                    onClose();
                  }}
                >
                  Apply
                </Button>
                <Button
                  aria-label={`Update view ${view.name}`}
                  onClick={() =>
                    run(() => {
                      storeView({ ...current, name: view.name }, view.id);
                      setMessage(`${view.name} updated to the current criteria.`);
                    })
                  }
                >
                  Update to current
                </Button>
                <Button
                  aria-label={`Delete view ${view.name}`}
                  onClick={() =>
                    run(() => {
                      removeView(view.id);
                      setRemoved(view);
                      setMessage("View removed. Undo is available below until this dialog closes.");
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {removed && (
          <Button
            onClick={() =>
              run(() => {
                restoreView(removed);
                setRemoved(null);
                setMessage("View restored.");
              })
            }
          >
            Undo view deletion
          </Button>
        )}
      </div>
      <div className="assistant-dialog-footer">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
