import { RecoveryRepo } from "../../db/repositories/RecoveryRepo";
import { OperationFeedback } from "../../components/ui/Feedback";
import { notify, notifyRemoval, operationError } from "../../services/feedback";
import { useState, useEffect } from "react";
import { Trash2 } from "../../components/icons";
import { GamesRepo } from "../../db/repositories/GamesRepo";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import type { Game, Log, Status, Completion, Ownership } from "../../types";
import type { LogUpdate } from "../../db/repositories/LogsRepo";

import { LogEditorHeader } from "./LogEditorHeader";
import { LogEditorStatus } from "./LogEditorStatus";
import { LogEditorDetails } from "./LogEditorDetails";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEditorProps {
  game: Game;
  log: Log;
  prefill?: Partial<Log>;
  isNew?: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

export type FormState = {
  status: Status;
  completion: Completion | undefined;
  completionPercentage: number | undefined;
  rating: number | undefined;
  platforms: string[];
  tagIds: string[];
  timePlayed: string;
  startedAt: string;
  finishedAt: string;
  ownership: Ownership[];
  notes: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LogEditor({
  game,
  log,
  prefill,
  isNew = false,
  onClose,
  onDelete,
}: LogEditorProps) {
  const { announce } = useLiveRegion();
  const [form, setForm] = useState<FormState>(() => {
    // If prefill has a single platform, ensure it maps to platforms array.
    const prefillPlatforms =
      prefill?.platforms || (prefill?.platform ? [prefill.platform] : undefined);

    return {
      status: prefill?.status ?? log.status,
      completion: prefill?.completion ?? log.completion,
      completionPercentage: prefill?.completionPercentage ?? log.completionPercentage,
      rating: prefill?.rating ?? log.rating,
      platforms:
        prefillPlatforms ?? (log.platforms ? log.platforms : log.platform ? [log.platform] : []),
      tagIds: prefill?.tagIds ?? log.tagIds ?? [],
      timePlayed:
        prefill?.timePlayed !== undefined
          ? String(prefill.timePlayed)
          : log.timePlayed !== undefined
            ? String(log.timePlayed)
            : "",
      startedAt: prefill?.startedAt ?? log.startedAt ?? "",
      finishedAt: prefill?.finishedAt ?? log.finishedAt ?? "",
      ownership:
        prefill?.ownership ??
        (log.ownership ? (Array.isArray(log.ownership) ? log.ownership : [log.ownership]) : []),
      notes: prefill?.notes ?? log.notes ?? "",
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [operationFailure, setOperationFailure] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Clear completion if status changes away from Played
  useEffect(() => {
    if (form.status !== "Played") {
      setForm((f) => ({ ...f, completion: undefined }));
    }
  }, [form.status]);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(currentForm: FormState): Record<string, string> {
    const errs: Record<string, string> = {};

    const tp = parseFloat(currentForm.timePlayed);
    if (currentForm.timePlayed !== "" && (!Number.isFinite(tp) || tp < 0)) {
      errs.timePlayed = "Time played must be a non-negative number.";
    }

    if (currentForm.startedAt && currentForm.finishedAt) {
      if (new Date(currentForm.finishedAt) < new Date(currentForm.startedAt)) {
        errs.finishedAt = "Finished date can't be before started date.";
      }
    }

    return errs;
  }

  // Dynamic validation
  useEffect(() => {
    setErrors(validate(form));
  }, [form]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const currentErrors = validate(form);
    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      announce("Please fix the errors before saving.");
      return;
    }
    if (saving || deleting) return;
    setOperationFailure("");
    setSaving(true);

    // Ensure Game exists in our local catalog before writing the Log
    try {
      const updates: LogUpdate = {
        status: form.status,
        completion: form.status === "Played" ? form.completion : undefined,
        completionPercentage:
          form.status === "Playing" || form.status === "Played"
            ? form.completionPercentage
            : undefined,
        rating: form.rating,
        tagIds: form.tagIds,
        platforms: form.platforms,
        platform: form.platforms[0],
        timePlayed: form.timePlayed !== "" ? parseFloat(form.timePlayed) : undefined,
        startedAt: form.startedAt || undefined,
        finishedAt: form.finishedAt || undefined,
        ownership: form.ownership,
        notes: form.notes,
      };

      await GamesRepo.saveReviewedLog(game, updates);
      notify("Game log saved", { intent: "success", message: game.title });
      announce("Log saved successfully.");
      onClose();
    } catch (e) {
      setOperationFailure(
        operationError(
          e,
          "Could not save your log. Your changes are still in the editor. Please try again."
        )
      );
      announce("Failed to save log. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || saving) return;
    setDeleting(true);
    setOperationFailure("");
    try {
      const recoveryId = await RecoveryRepo.removeGame(game.igdbId);
      notifyRemoval(`${game.title} removed`, recoveryId);
      onDelete?.();
      onClose();
    } catch (error) {
      setOperationFailure(operationError(error, "Could not remove this game. Please try again."));
    } finally {
      setDeleting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const set = (key: keyof FormState, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const toggleOwnership = (o: Ownership) => {
    setForm((f) => {
      const active = f.ownership.includes(o);
      const next = active ? f.ownership.filter((x) => x !== o) : [...f.ownership, o];
      return { ...f, ownership: next };
    });
  };

  const togglePlatform = (p: string) => {
    setForm((f) => {
      const active = f.platforms.includes(p);
      const next = active ? f.platforms.filter((x) => x !== p) : [...f.platforms, p];
      return { ...f, platforms: next };
    });
  };

  const hasSaveErrors = Object.keys(errors).length > 0;

  return (
    <Modal
      busy={saving || deleting}
      ariaLabel="Edit game log"
      isOpen={true}
      onClose={onClose}
      width={470}
    >
      <LogEditorHeader game={game} disabled={saving || deleting} onClose={onClose} />
      <OperationFeedback error={operationFailure} />
      {isNew && (
        <p style={{ padding: "0 var(--space-5)", color: "var(--app-secondary-label)" }}>
          Not in your library yet. Save to add this game; Cancel leaves your library unchanged.
        </p>
      )}

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5) var(--space-5) 0" }}>
        <LogEditorStatus
          status={form.status}
          completion={form.completion}
          completionPercentage={form.completionPercentage}
          rating={form.rating}
          onSet={set}
        />

        <LogEditorDetails
          game={game}
          platforms={form.platforms}
          timePlayed={form.timePlayed}
          startedAt={form.startedAt}
          finishedAt={form.finishedAt}
          ownership={form.ownership}
          tagIds={form.tagIds}
          notes={form.notes}
          errors={errors}
          onSet={set}
          togglePlatform={togglePlatform}
          toggleOwnership={toggleOwnership}
        />
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isNew ? "flex-end" : "space-between",
          padding: "var(--space-4) var(--space-5)",
          borderTop: "1px solid var(--app-separator)",
          flexShrink: 0,
          marginTop: "var(--space-1)",
        }}
      >
        {confirmDelete ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 500,
                color: "var(--app-red)",
              }}
            >
              Remove this game from library?
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!isNew && (
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                style={{ color: "var(--app-red)" }}
              >
                <Trash2 size={14} /> Remove from library
              </Button>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="secondary" disabled={saving || deleting} onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={hasSaveErrors || deleting}
                loading={saving}
              >
                Save
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
