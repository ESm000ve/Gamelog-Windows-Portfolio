import { useRef, type ReactNode, type RefObject } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { OperationFeedback } from "./Feedback";
import "./ConfirmDialog.css";

export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  error,
  danger = false,
  restoreFocusRef,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: string;
  danger?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      showCloseButton={false}
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      busy={busy}
      restoreFocusRef={restoreFocusRef}
      initialFocusRef={cancelRef}
      width={480}
    >
      <div className="app-confirm-body">
        <p>{children}</p>
        <OperationFeedback error={error} />
      </div>
      <div className="app-confirm-actions">
        <Button ref={cancelRef} variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
