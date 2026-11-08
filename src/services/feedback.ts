import { RecoveryRepo } from "../db/repositories/RecoveryRepo";
export interface Notice {
  id: string;
  title: string;
  message?: string;
  intent: "success" | "error" | "info";
  recoveryId?: string;
}
const listeners = new Set<(notice: Notice) => void>();
let pending: Notice[] = [];
export function notify(title: string, options: Partial<Omit<Notice, "id" | "title">> = {}) {
  const notice: Notice = { id: crypto.randomUUID(), title, intent: "info", ...options };
  if (listeners.size) listeners.forEach((listener) => deliver(listener, notice));
  else pending = [...pending, notice].slice(-20);
}
export function subscribeNotices(listener: (notice: Notice) => void) {
  listeners.add(listener);
  const queued = pending;
  pending = [];
  queued.forEach((notice) => deliver(listener, notice));
  return () => {
    listeners.delete(listener);
  };
}
export function notifyRemoval(title: string, recoveryId: string | undefined) {
  notify(title, {
    intent: "success",
    recoveryId,
    message: recoveryId
      ? "You can undo this or restore it later in Settings > Recently removed."
      : undefined,
  });
}
export const undoRemoval = (id: string) => RecoveryRepo.restore(id);
export function operationError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function deliver(listener: (notice: Notice) => void, notice: Notice) {
  try {
    listener(notice);
  } catch (error) {
    console.error("Could not show operation feedback", error);
  }
}
