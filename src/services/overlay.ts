import { useCallback, useId, useEffect, useSyncExternalStore } from "react";
let activeFlyout: string | null = null;
let activeDialog: { id: string; close: () => void } | null = null;
const dialogListeners = new Set<() => void>();
export function subscribeDialogs(listener: () => void) {
  dialogListeners.add(listener);
  return () => {
    dialogListeners.delete(listener);
  };
}
const notifyDialogs = () => dialogListeners.forEach((listener) => listener());
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export function getOpenFlyout() {
  return activeFlyout;
}
export function dismissFlyouts() {
  activeFlyout = null;
  notify();
}
export function setFlyout(id: string, open: boolean) {
  if (open && activeDialog) return;
  if (open) activeFlyout = id;
  else if (activeFlyout === id) activeFlyout = null;
  notify();
}
export function registerDialog(id: string, close: () => void) {
  dismissFlyouts();
  if (activeDialog && activeDialog.id !== id) activeDialog.close();
  activeDialog = { id, close };
  notifyDialogs();
  return () => {
    if (activeDialog?.id === id) {
      activeDialog = null;
      notifyDialogs();
    }
  };
}
export function hasOpenDialog() {
  return activeDialog !== null;
}
export function useFlyout() {
  const id = useId();
  useEffect(() => () => setFlyout(id, false), [id]);
  const open = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => activeFlyout === id,
    () => false
  );
  const setOpen = useCallback(
    (next: boolean | ((previous: boolean) => boolean)) => {
      setFlyout(id, typeof next === "function" ? next(activeFlyout === id) : next);
    },
    [id]
  );
  return [open, setOpen] as const;
}
