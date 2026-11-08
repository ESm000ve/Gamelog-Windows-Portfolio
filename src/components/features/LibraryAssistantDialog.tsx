import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextInput, SelectControl, CheckControl } from "../ui/Controls";
import { OperationFeedback } from "../ui/Feedback";
import { ActiveFilterBadges } from "./FilterBar";
import { useLibrary } from "../../hooks/useLibrary";
import {
  interpretLibraryRequest,
  matchLibrary,
  createReviewedList,
  type LibraryCriteria,
  type LibraryInterpretation,
} from "../../services/libraryAssistant";
import { notify } from "../../services/feedback";
import type { Status } from "../../types";
import "./LibraryAssistant.css";
export function LibraryAssistantDialog({
  mode,
  onClose,
  onApply,
  onCreated,
  restoreFocusRef,
}: {
  mode: "find" | "list";
  onClose: () => void;
  onApply?: (criteria: LibraryCriteria) => void;
  onCreated?: (id: string) => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const entries = useLibrary({ sort: "title-asc" });
  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<LibraryInterpretation | null>(null);
  const [interpreting, setInterpreting] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState("New shortlist"),
    [size, setSize] = useState(5),
    [selected, setSelected] = useState<Set<number>>(new Set());
  const controller = useRef<AbortController | null>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const matches = useMemo(
    () => (draft ? matchLibrary(entries ?? [], draft) : []),
    [entries, draft]
  );
  const reviewInput = useRef<HTMLInputElement>(null),
    pendingReviewFocus = useRef(false);
  useEffect(() => {
    if (pendingReviewFocus.current && draft && !interpreting && reviewInput.current) {
      reviewInput.current.focus();
      pendingReviewFocus.current = false;
    }
  }, [draft, interpreting]);
  function openReview(value: LibraryInterpretation) {
    pendingReviewFocus.current = true;
    setDraft(value);
  }
  const criteriaKey = JSON.stringify(
    draft && { titleQuery: draft.titleQuery, filters: draft.filters }
  );
  useEffect(() => {
    setSelected(new Set(matches.slice(0, size).map((entry) => entry.game.igdbId)));
  }, [criteriaKey, size]);
  const genres = [...new Set((entries ?? []).flatMap((entry) => entry.game.genres))].sort();
  const platforms = [
    ...new Set(
      (entries ?? []).flatMap((entry) =>
        entry.log.platforms?.length
          ? entry.log.platforms
          : entry.log.platform
            ? [entry.log.platform]
            : entry.game.platforms.length === 1
              ? entry.game.platforms
              : []
      )
    ),
  ].sort();
  async function interpret() {
    if (interpreting || saving || !request.trim() || !entries) return;
    const task = new AbortController();
    controller.current?.abort();
    controller.current = task;
    setInterpreting(true);
    setError("");
    try {
      const result = await interpretLibraryRequest(request, entries, mode === "list", task.signal);
      if (task.signal.aborted) return;
      openReview(result);
      if (mode === "list") setName(request.trim().slice(0, 80));
    } catch (error) {
      if (!task.signal.aborted)
        setError(error instanceof Error ? error.message : "Could not interpret this request.");
    } finally {
      if (!task.signal.aborted) setInterpreting(false);
    }
  }
  function update(next: Partial<LibraryCriteria>) {
    if (draft) setDraft({ ...draft, ...next });
    setError("");
  }
  async function save() {
    if (!draft || saving || interpreting) return;
    setSaving(true);
    setError("");
    try {
      const id = await createReviewedList(name, [...selected], draft);
      notify("List created", {
        intent: "success",
        message: "You can edit or remove this list like any other list.",
      });
      onCreated?.(id);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create this list. Your draft was kept."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={mode === "find" ? "Ask your library" : "Draft a list"}
      isOpen
      onClose={onClose}
      busy={saving}
      initialFocusRef={input}
      restoreFocusRef={restoreFocusRef}
      width={720}
    >
      <div className="assistant-dialog-body">
        <p className="assistant-help">
          Describe games to find in your existing library. Only this request is sent to Gemini; your
          library and stored notes stay on this device. Review all criteria before{" "}
          {mode === "find" ? "applying them" : "creating a list"}.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void interpret();
          }}
          className="assistant-request"
        >
          <label>
            Your request
            <TextInput
              ref={input}
              aria-label="Library request"
              value={request}
              maxLength={2000}
              placeholder={
                mode === "find"
                  ? "My unplayed RPGs under ten hours"
                  : "A weekend shortlist from my backlog"
              }
              disabled={saving}
              onChange={(event) => {
                controller.current?.abort();
                setInterpreting(false);
                setRequest(event.target.value);
                setDraft(null);
                setError("");
              }}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            loading={interpreting}
            disabled={saving || !request.trim() || !entries}
          >
            Interpret request
          </Button>
          {interpreting && (
            <Button
              onClick={() => {
                controller.current?.abort();
                setInterpreting(false);
              }}
            >
              Stop
            </Button>
          )}
        </form>
        {!draft && !interpreting && (
          <Button
            variant="ghost"
            disabled={!entries}
            onClick={() =>
              openReview({
                titleQuery: "",
                filters: {
                  platformSource: "recorded",
                  ...(mode === "list" ? { status: ["Backlog" as Status] } : {}),
                },
                mode: "local",
                notice: "Manual criteria. Only these fields will be applied.",
              })
            }
          >
            Choose filters manually
          </Button>
        )}
        {draft && (
          <>
            <p role="status" className="assistant-notice">
              {draft.notice}
            </p>
            <fieldset className="assistant-criteria" disabled={saving || interpreting}>
              <legend>Review criteria</legend>
              <label>
                Title keywords
                <TextInput
                  ref={reviewInput}
                  aria-label="Title keywords"
                  value={draft.titleQuery}
                  onChange={(event) => update({ titleQuery: event.target.value })}
                />
              </label>
              <label>
                Status
                <SelectControl
                  aria-label="Draft status"
                  value={
                    draft.filters.status?.length === 2
                      ? "Unplayed"
                      : (draft.filters.status?.[0] ?? "All")
                  }
                  onChange={(event) =>
                    update({
                      filters: {
                        ...draft.filters,
                        status:
                          event.target.value === "All"
                            ? undefined
                            : event.target.value === "Unplayed"
                              ? ["Backlog", "Wishlist"]
                              : [event.target.value as Status],
                      },
                    })
                  }
                >
                  {["All", "Backlog", "Playing", "Played", "Wishlist", "Unplayed"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </SelectControl>
              </label>
              <label>
                Add genre
                <SelectControl
                  aria-label="Add genre filter"
                  value=""
                  onChange={(event) => {
                    if (event.target.value)
                      update({
                        filters: {
                          ...draft.filters,
                          genres: [
                            ...new Set([...(draft.filters.genres ?? []), event.target.value]),
                          ],
                        },
                      });
                  }}
                >
                  <option value="">Choose a genre</option>
                  {genres.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </SelectControl>
              </label>
              <label>
                Add recorded platform
                <SelectControl
                  aria-label="Add platform filter"
                  value=""
                  onChange={(event) => {
                    if (event.target.value)
                      update({
                        filters: {
                          ...draft.filters,
                          platforms: [
                            ...new Set([...(draft.filters.platforms ?? []), event.target.value]),
                          ],
                        },
                      });
                  }}
                >
                  <option value="">Choose a platform</option>
                  {platforms.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </SelectControl>
              </label>
              <label>
                Maximum story hours per game
                <TextInput
                  type="number"
                  aria-label="Maximum story hours"
                  min={0.1}
                  max={10000}
                  step="0.5"
                  value={draft.filters.timeToBeat?.max ?? ""}
                  onChange={(event) =>
                    update({
                      filters: {
                        ...draft.filters,
                        timeToBeat: event.target.value
                          ? { max: Math.max(0, Math.min(10000, Number(event.target.value))) }
                          : undefined,
                      },
                    })
                  }
                />
              </label>
              <label>
                Minimum rating out of 5
                <TextInput
                  type="number"
                  aria-label="Minimum draft rating"
                  min={0.5}
                  max={5}
                  step="0.5"
                  value={draft.filters.rating?.min ?? ""}
                  onChange={(event) =>
                    update({
                      filters: {
                        ...draft.filters,
                        rating: event.target.value
                          ? { min: Math.max(0, Math.min(5, Number(event.target.value))) }
                          : undefined,
                      },
                    })
                  }
                />
              </label>
            </fieldset>
            <div className="assistant-chips">
              <ActiveFilterBadges
                spec={draft.filters}
                onChange={(filters) =>
                  update({ filters: { ...filters, platformSource: "recorded" } })
                }
              />
            </div>
            <p className="assistant-help">
              A time limit excludes unknown story lengths. Platform filters use your logged
              platforms, or a catalog platform only when there is a single unambiguous option. Other
              requested details are not applied unless shown above.
            </p>
            {mode === "list" && (
              <div className="assistant-criteria">
                <label>
                  List name
                  <TextInput
                    aria-label="Draft list name"
                    value={name}
                    maxLength={80}
                    disabled={saving}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  Initial selection
                  <SelectControl
                    aria-label="Initial shortlist size"
                    value={size}
                    disabled={saving}
                    onChange={(event) => setSize(Number(event.target.value))}
                  >
                    {[3, 5, 10, 20].map((value) => (
                      <option key={value} value={value}>
                        {value} games
                      </option>
                    ))}
                  </SelectControl>
                </label>
              </div>
            )}
            <section aria-label="Matching games">
              <h3>
                {matches.length} matching {matches.length === 1 ? "game" : "games"}
              </h3>
              <ul className="assistant-preview">
                {matches.slice(0, mode === "list" ? 20 : 8).map(({ game, log }) => (
                  <li key={game.igdbId}>
                    {mode === "list" ? (
                      <CheckControl
                        label={game.title}
                        ariaLabel={`Include ${game.title}`}
                        disabled={saving}
                        checked={selected.has(game.igdbId)}
                        onChange={(checked) =>
                          setSelected((previous) => {
                            const next = new Set(previous);
                            if (checked) next.add(game.igdbId);
                            else next.delete(game.igdbId);
                            return next;
                          })
                        }
                      />
                    ) : (
                      <strong>{game.title}</strong>
                    )}
                    <span>
                      {log.status} ·{" "}
                      {game.timeToBeat?.finish
                        ? `${game.timeToBeat.finish}h main story`
                        : "Story length unknown"}{" "}
                      · {game.genres.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
              {matches.length > (mode === "list" ? 20 : 8) && (
                <p className="assistant-help">
                  Showing the first {mode === "list" ? 20 : 8} matches alphabetically. Narrow the
                  criteria to see other games.
                </p>
              )}
            </section>
          </>
        )}
        <OperationFeedback error={error} />
      </div>
      <div className="assistant-dialog-footer">
        <Button disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        {draft &&
          (mode === "find" ? (
            <Button
              variant="primary"
              disabled={interpreting}
              onClick={() => {
                onApply?.({ titleQuery: draft.titleQuery, filters: draft.filters });
                onClose();
              }}
            >
              Apply filters
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={saving}
              disabled={interpreting || !name.trim() || !selected.size}
              onClick={save}
            >
              Create list ({selected.size})
            </Button>
          ))}
      </div>
    </Modal>
  );
}
