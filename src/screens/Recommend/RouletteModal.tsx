import { useState, useEffect, useRef, type RefObject } from "react";
import { Spinner } from "@fluentui/react-components";
import { Dices } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { SelectControl } from "../../components/ui/Controls";
import { Modal } from "../../components/ui/Modal";
import { OperationFeedback } from "../../components/ui/Feedback";
import {
  drawPlayPick,
  playReason,
  PLAY_POOLS,
  type PlayPool,
} from "../../services/playEligibility";
import type { LibraryEntry } from "../../types";
import { PlayCover } from "./PlayCover";
interface Props {
  entries: LibraryEntry[];
  loading: boolean;
  pool: PlayPool;
  onPoolChange: (pool: PlayPool) => void;
  maxHours?: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onOpenGame: (id: number) => void;
  onAct: (id: number) => Promise<void>;
  restoreFocusRef: RefObject<HTMLButtonElement | null>;
}
export function RouletteModal({
  entries,
  loading,
  pool,
  onPoolChange,
  maxHours,
  busy,
  error,
  onClose,
  onOpenGame,
  onAct,
  restoreFocusRef,
}: Props) {
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const seen = useRef(new Set<number>());
  const lastId = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<LibraryEntry | null>(null);
  const signature = JSON.stringify([
    pool,
    maxHours,
    entries.map((entry) => entry.game.igdbId).sort((a, b) => a - b),
  ]);
  useEffect(() => {
    clearTimeout(timer.current);
    pending.current = null;
    seen.current.clear();
    lastId.current = undefined;
    setWinnerId(null);
    setSpinning(false);
    return () => {
      clearTimeout(timer.current);
      pending.current = null;
    };
  }, [signature]);
  const reveal = () => {
    clearTimeout(timer.current);
    if (pending.current) {
      setWinnerId(pending.current.game.igdbId);
      lastId.current = pending.current.game.igdbId;
    }
    pending.current = null;
    setSpinning(false);
  };
  const spin = () => {
    if (spinning || busy) return;
    const drawn = drawPlayPick(entries, seen.current, lastId.current);
    if (!drawn) return;
    if (drawn.reset) seen.current.clear();
    seen.current.add(drawn.entry.game.igdbId);
    pending.current = drawn.entry;
    setWinnerId(null);
    if (entries.length === 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      reveal();
    else {
      setSpinning(true);
      timer.current = setTimeout(reveal, 900);
    }
  };
  const winner = entries.find((entry) => entry.game.igdbId === winnerId);
  return (
    <Modal
      title="Game roulette"
      isOpen
      onClose={onClose}
      busy={busy}
      width={600}
      restoreFocusRef={restoreFocusRef}
    >
      <div className="roulette-content">
        <label className="roulette-pool">
          Choose from
          <SelectControl
            aria-label="Roulette play pool"
            value={pool}
            disabled={busy || spinning}
            onChange={(event) => onPoolChange(event.target.value as PlayPool)}
          >
            {PLAY_POOLS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectControl>
        </label>
        <p className="recommend-help">
          {loading
            ? "Loading your play pool…"
            : `${entries.length} eligible ${entries.length === 1 ? "game" : "games"}${maxHours ? ` · up to ${maxHours}h main story` : ""}`}
          . Uses the page’s play pool and story-length filter. Wishlist games stay out.
        </p>
        <OperationFeedback error={error} />
        {loading ? (
          <Spinner label="Loading eligible games" />
        ) : entries.length === 0 ? (
          <div className="roulette-empty">
            <h3>No games in this play pool</h3>
            <p>
              Choose another pool, or close roulette and remove the story-length limit. Played games
              with no date or no recorded play in over a year are eligible to revisit.
            </p>
          </div>
        ) : (
          <>
            <div className="roulette-result" aria-live="polite" aria-atomic="true">
              {spinning ? (
                <div className="roulette-ready">
                  <Spinner label="Choosing your game…" />
                  <p>No rapid flashing. Reveal your pick whenever you are ready.</p>
                </div>
              ) : winner ? (
                <>
                  <div className="roulette-cover">
                    <PlayCover game={winner.game} />
                  </div>
                  <div>
                    <p className="recommend-help">
                      Your pick · {winner.log.status === "Played" ? "Revisit" : winner.log.status}
                    </p>
                    <h3>{winner.game.title}</h3>
                    <p>{playReason(winner.log)}</p>
                    {winner.game.timeToBeat?.finish && (
                      <p className="recommend-help">
                        About {winner.game.timeToBeat.finish}h main story
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="roulette-ready">
                  <Dices size={32} aria-hidden />
                  <h3>Let roulette choose</h3>
                  <p>
                    Every eligible game has an equal chance. Picks do not repeat until you have seen
                    the whole pool.
                  </p>
                </div>
              )}
            </div>
            <div className="recommend-actions">
              {spinning ? (
                <Button variant="primary" onClick={reveal}>
                  Reveal now
                </Button>
              ) : (
                <Button variant={winner ? "secondary" : "primary"} onClick={spin} disabled={busy}>
                  {winner ? "Spin again" : "Spin"}
                </Button>
              )}
              {winner && (
                <>
                  <Button
                    variant="primary"
                    onClick={() => onOpenGame(winner.game.igdbId)}
                    disabled={busy}
                  >
                    View game
                  </Button>
                  <Button
                    disabled={busy}
                    loading={busy}
                    onClick={() => void onAct(winner.game.igdbId)}
                  >
                    {winner.log.status === "Played"
                      ? "Record play today"
                      : winner.log.status === "Playing"
                        ? "Continue playing"
                        : "Mark as playing"}
                  </Button>
                </>
              )}
            </div>
            <p className="recommend-help">
              Spinning or viewing a game changes nothing in your library. Record play today adds a
              dated session and preserves your earlier completion record.
            </p>
            <details className="roulette-eligible">
              <summary>Eligible games ({entries.length})</summary>
              <ul>
                {entries.map((entry) => (
                  <li key={entry.game.igdbId}>
                    {entry.game.title}{" "}
                    <span>· {entry.log.status === "Played" ? "Revisit" : entry.log.status}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </Modal>
  );
}
