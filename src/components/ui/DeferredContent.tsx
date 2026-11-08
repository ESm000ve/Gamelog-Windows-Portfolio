import { Component, Suspense, type ReactNode, type ErrorInfo } from "react";
import { Spinner } from "@fluentui/react-components";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { EmptyState } from "./PageLayout";
import "./DeferredContent.css";

interface BoundaryProps {
  children: ReactNode;
  resetKey?: string;
  onClose?: () => void;
  title?: string;
}
class ContentBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Could not display app content", error, info.componentStack);
  }
  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const message = (
      <EmptyState
        alert
        title="This view could not be loaded"
        description="Reload the app to try again. Your saved library stays on this device."
        actions={
          <>
            {this.props.onClose && <Button onClick={this.props.onClose}>Close</Button>}
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </>
        }
      />
    );
    return this.props.onClose ? (
      <Modal isOpen onClose={this.props.onClose} title={this.props.title}>
        {message}
      </Modal>
    ) : (
      <main id="main-content" className="deferred-page">
        {message}
      </main>
    );
  }
}
/** Keep navigation available while an optional page downloads or fails. */
export function DeferredPage({ children, resetKey }: BoundaryProps) {
  return (
    <ContentBoundary resetKey={resetKey}>
      <Suspense
        fallback={
          <main id="main-content" className="deferred-page">
            <Spinner label="Loading page…" />
          </main>
        }
      >
        {children}
      </Suspense>
    </ContentBoundary>
  );
}
/** A dialog still opens immediately and supports Escape during its first load. */
export function DeferredDialog({
  children,
  onClose,
  title,
}: BoundaryProps & { onClose: () => void; title: string }) {
  return (
    <ContentBoundary onClose={onClose} title={title}>
      <Suspense
        fallback={
          <Modal isOpen onClose={onClose} title={title}>
            <div className="deferred-dialog">
              <Spinner label="Loading…" />
            </div>
          </Modal>
        }
      >
        {children}
      </Suspense>
    </ContentBoundary>
  );
}
