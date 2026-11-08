import "./Feedback.css";
import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Toaster,
  Toast,
  ToastTitle,
  ToastBody,
  ToastFooter,
  ToastTrigger,
  useToastController,
  MessageBar,
  MessageBarBody,
  Spinner,
  ProgressBar,
} from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import {
  subscribeNotices,
  undoRemoval,
  operationError,
  notify,
  type Notice,
} from "../../services/feedback";
import { hasOpenDialog, subscribeDialogs } from "../../services/overlay";
import { Button } from "./Button";
export function FeedbackHost() {
  const { dispatchToast, dismissToast, dismissAllToasts } = useToastController("gamelog-feedback");
  const location = useLocation();
  const recoveryView = location.pathname === "/settings" && location.hash === "#recently-removed";
  useEffect(() => {
    if (recoveryView) dismissAllToasts();
  }, [recoveryView, dismissAllToasts]);
  const dialogOpen = useSyncExternalStore(subscribeDialogs, hasOpenDialog, () => false);
  useEffect(() => {
    document.documentElement.dataset.feedbackHidden = String(dialogOpen || recoveryView);
    return () => {
      delete document.documentElement.dataset.feedbackHidden;
    };
  }, [dialogOpen, recoveryView]);
  const deferred = useRef<Notice[]>([]);
  const show = useCallback(
    (notice: Notice) =>
      dispatchToast(<FeedbackToast notice={notice} dismiss={() => dismissToast(notice.id)} />, {
        toastId: notice.id,
        intent: notice.intent,
        timeout: notice.recoveryId || notice.intent === "error" ? -1 : 6000,
      }),
    [dispatchToast, dismissToast]
  );
  useEffect(
    () =>
      subscribeNotices((notice) => {
        if (hasOpenDialog()) deferred.current.push(notice);
        else show(notice);
      }),
    [show]
  );
  useEffect(() => {
    if (!dialogOpen) deferred.current.splice(0).forEach(show);
  }, [dialogOpen, show]);
  return <Toaster toasterId="gamelog-feedback" position="bottom-end" limit={3} />;
}
function FeedbackToast({ notice, dismiss }: { notice: Notice; dismiss: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Toast className="feedback-toast">
      <ToastTitle
        action={
          <ToastTrigger>
            <Button variant="ghost" aria-label="Dismiss notification">
              <Dismiss20Regular />
            </Button>
          </ToastTrigger>
        }
      >
        {notice.title}
      </ToastTitle>
      {(notice.message || error) && <ToastBody>{error || notice.message}</ToastBody>}
      {notice.recoveryId && (
        <ToastFooter>
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await undoRemoval(notice.recoveryId!);
                dismiss();
                notify("Restored successfully", { intent: "success" });
              } catch (error) {
                setError(operationError(error, "Could not restore this item. Please try again."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              dismiss();
              navigate("/settings#recently-removed");
            }}
          >
            Recently removed
          </Button>
        </ToastFooter>
      )}
    </Toast>
  );
}
export function OperationFeedback({
  error,
  busy,
  message,
  progress,
}: {
  error?: string;
  busy?: boolean;
  message?: string;
  progress?: number;
}) {
  if (error)
    return (
      <MessageBar intent="error" role="alert">
        <MessageBarBody>{error}</MessageBarBody>
      </MessageBar>
    );
  if (!busy && !message) return null;
  return (
    <div role="status" style={{ display: "grid", gap: 8, padding: "12px 0", fontSize: 14 }}>
      {busy ? <Spinner size="tiny" label={message ?? "Working..."} /> : message}
      {busy && progress !== undefined && (
        <ProgressBar aria-label={message ?? "Progress"} max={100} value={progress} />
      )}
    </div>
  );
}
