import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from "react";
import { Dialog, DialogSurface } from "@fluentui/react-components";
import { X } from "../icons";
import { registerDialog, hasOpenDialog } from "../../services/overlay";
import { Button } from "./Button";
import "./Modal.css";
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  width?: number | string;
  busy?: boolean;
  showCloseButton?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}
export function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  width = 540,
  busy = false,
  showCloseButton = true,
  restoreFocusRef,
  initialFocusRef,
}: ModalProps) {
  const id = useId();

  const closeRef = useRef(onClose);
  closeRef.current = () => {
    if (!busy) onClose();
  };
  useEffect(() => {
    if (isOpen) return registerDialog(id, () => closeRef.current());
  }, [isOpen, id]);
  useEffect(() => {
    if (!isOpen || !initialFocusRef) return;
    const timer = setTimeout(() => initialFocusRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [isOpen, initialFocusRef]);
  useEffect(() => {
    if (!isOpen || !restoreFocusRef) return;
    return () => {
      // Menu items disappear when a confirmation opens. Return to their stable trigger.
      setTimeout(() => {
        // An older dialog must not move focus outside a newer dialog.
        if (!hasOpenDialog() && restoreFocusRef.current?.isConnected)
          restoreFocusRef.current.focus();
      }, 0);
    };
  }, [isOpen, restoreFocusRef]);
  const body = (
    <>
      {title && (
        <div className="modal-header">
          <h2 id={id + "-title"} className="modal-title">
            {title}
          </h2>
          {showCloseButton && (
            <Button
              variant="ghost"
              onClick={() => closeRef.current()}
              disabled={busy}
              aria-label="Close dialog"
            >
              <X size={20} />
            </Button>
          )}
        </div>
      )}
      <div className="app-dialog-content modal-body">{children}</div>
    </>
  );
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(_event, data) => {
        if (!data.open) closeRef.current();
      }}
    >
      <DialogSurface
        className="app-dialog-surface"
        aria-label={title ? undefined : (ariaLabel ?? "Game dialog")}
        aria-labelledby={title ? id + "-title" : undefined}
        style={
          { "--dialog-width": typeof width === "number" ? width + "px" : width } as CSSProperties
        }
      >
        {body}
      </DialogSurface>
    </Dialog>
  );
}
