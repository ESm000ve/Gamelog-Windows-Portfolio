import { MoreHorizontal, Edit3, ExternalLink, Check } from "../icons";
import { ActionMenu, type ActionMenuItem } from "../ui/ActionMenu";
import { Button } from "../ui/Button";
import { CoverCardMetadata } from "./CoverCardMetadata";
import type { CoverCardProps } from "./types";
import type { Status } from "../../types";
import "./CoverCard.css";
export function CoverCard({
  game,
  onClick,
  onChangeStatus,
  onRate,
  onLog,
  selectable,
  selected,
  onToggleSelect,
  tabIndex = 0,
}: CoverCardProps) {
  const items: ActionMenuItem[] = [];
  if (onLog)
    items.push({
      key: "log",
      label: "Edit game log",
      icon: <Edit3 size={20} />,
      onClick: () => onLog(game.igdbId),
    });
  if (onChangeStatus)
    items.push({
      key: "status",
      label: "Change status",
      children: (["Wishlist", "Backlog", "Playing", "Played"] as Status[]).map((status) => ({
        key: status,
        label: status,
        checked: game.status === status,
        onClick: () => onChangeStatus(game.igdbId, status),
      })),
    });
  if (onRate)
    items.push({
      key: "rating",
      label: "Rate game",
      children: Array.from({ length: 10 }, (_, index) => {
        const rating = (index + 1) / 2;
        return {
          key: String(rating),
          label: rating + " stars",
          checked: game.rating === rating,
          onClick: () => onRate(game.igdbId, rating),
        };
      }),
    });
  if (onClick)
    items.push({
      key: "details",
      label: "View details",
      icon: <ExternalLink size={20} />,
      onClick: () => onClick(game.igdbId),
    });
  return (
    <article className="cover-card-container">
      <button
        type="button"
        tabIndex={tabIndex}
        className={"cover-card-btn " + (selected ? "selected" : "")}
        aria-label={game.title + (game.status ? ", Status: " + game.status : "")}
        aria-pressed={selectable ? !!selected : undefined}
        style={{ background: game.coverColor ?? "var(--app-tertiary-bg)" }}
        onClick={(e) => (selectable ? onToggleSelect?.(game.igdbId, e) : onClick?.(game.igdbId))}
      >
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt=""
            className="cover-image"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="cover-placeholder">
            <span>{game.title}</span>
          </div>
        )}
        {selectable && (
          <span
            className={
              "cover-selection-indicator " + "windows " + (selected ? "selected" : "unselected")
            }
            aria-hidden="true"
          >
            {selected ? <Check size={16} /> : null}
          </span>
        )}
        {(game.completionPercentage ?? 0) > 0 && (
          <span className="cover-progress-bar">
            <span
              className="cover-progress-fill"
              style={{ display: "block", width: game.completionPercentage + "%" }}
            />
          </span>
        )}
      </button>
      <div className="cover-card-caption">
        <h3 className="cover-game-title" title={game.title}>
          {game.title}
        </h3>
        {!selectable && items.length > 0 && (
          <ActionMenu
            label={"Actions for " + game.title}
            trigger={
              <Button variant="ghost" size="sm" aria-label={"Actions for " + game.title}>
                <MoreHorizontal size={20} />
              </Button>
            }
            items={items}
          />
        )}
      </div>
      <CoverCardMetadata
        platform={game.platform}
        releaseYear={game.releaseYear}
        status={game.status}
        completion={game.completion}
        rating={game.rating}
      />
      {game.dealPrice !== undefined && game.dealUrl && (
        <a
          className="cover-deal-link"
          href={game.dealUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View deal · $ {game.dealPrice.toFixed(2)}
        </a>
      )}
    </article>
  );
}
export type { CoverCardProps, CoverCardGame } from "./types";
