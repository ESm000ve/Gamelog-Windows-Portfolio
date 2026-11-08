import { Link } from "react-router-dom";
import { ProgressBar } from "@fluentui/react-components";
import type { Game, Log } from "../../types";
import type { SortKey } from "../../hooks/useLibrary";
import { loggedPlatforms } from "../../services/libraryPresentation";
import { Button } from "../../components/ui/Button";
import { ArrowUpDown, Edit3 } from "../../components/icons";
interface LibraryTableViewProps {
  entries: { game: Game; log?: Log }[];
  onOpenGame?: (id: number) => void;
  onOpenLog?: (id: number) => void;
  sortKey?: SortKey;
  onSortChange?: (key: SortKey) => void;
}
export function LibraryTableView({
  entries,
  onOpenGame,
  onOpenLog,
  sortKey,
  onSortChange,
}: LibraryTableViewProps) {
  const sortHeading = (label: string, key: SortKey, active: boolean, ascending = false) => (
    <th scope="col" aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}>
      <Button
        variant="ghost"
        aria-label={`Sort by ${label.toLowerCase()}`}
        onClick={() => onSortChange?.(key)}
      >
        {label}
        <ArrowUpDown size={16} aria-hidden="true" />
      </Button>
    </th>
  );
  return (
    <div
      className="library-table-scroll"
      role="region"
      aria-label="Library table, scroll horizontally for more columns"
      tabIndex={0}
    >
      <table className="library-table" aria-label="Library games">
        <thead>
          <tr>
            {sortHeading(
              "Title",
              sortKey === "title-asc" ? "title-desc" : "title-asc",
              sortKey === "title-asc" || sortKey === "title-desc",
              sortKey === "title-asc"
            )}
            <th scope="col">Status</th>
            {sortHeading("Rating", "rating", sortKey === "rating")}
            <th scope="col">Recorded platforms</th>
            {sortHeading("Playtime", "time", sortKey === "time")}
            <th scope="col">Progress / outcome</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ game, log }) => {
            const platforms = loggedPlatforms(log),
              hours =
                typeof log?.timePlayed === "number" &&
                Number.isFinite(log.timePlayed) &&
                log.timePlayed >= 0
                  ? log.timePlayed
                  : undefined;
            const rating =
              typeof log?.rating === "number" &&
              Number.isFinite(log.rating) &&
              log.rating >= 0.5 &&
              log.rating <= 5
                ? log.rating
                : undefined;
            const progress =
              typeof log?.completionPercentage === "number" &&
              Number.isFinite(log.completionPercentage) &&
              log.completionPercentage >= 0 &&
              log.completionPercentage <= 100
                ? log.completionPercentage
                : undefined;
            return (
              <tr key={game.igdbId}>
                <td>
                  <div className="library-table-title">
                    {game.coverUrl && <img src={game.coverUrl} alt="" loading="lazy" />}
                    <div>
                      <Link
                        to={`/game/${game.igdbId}`}
                        onClick={(event) => {
                          if (onOpenGame) {
                            event.preventDefault();
                            onOpenGame(game.igdbId);
                          }
                        }}
                      >
                        {game.title}
                      </Link>
                      <small>
                        {game.releaseYear > 0 ? game.releaseYear : "Year not recorded"} ·{" "}
                        {game.developer || "Developer not recorded"}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="library-table-status">{log?.status ?? "Not logged"}</span>
                </td>
                <td>
                  {rating !== undefined ? (
                    `${rating} / 5`
                  ) : (
                    <span className="library-table-missing">Not rated</span>
                  )}
                </td>
                <td>
                  {platforms.join(", ") || (
                    <span className="library-table-missing">Not recorded</span>
                  )}
                </td>
                <td>
                  {hours !== undefined ? (
                    `${hours}h`
                  ) : (
                    <span className="library-table-missing">Not recorded</span>
                  )}
                </td>
                <td>
                  {progress !== undefined ? (
                    <div className="library-table-progress">
                      {
                        <ProgressBar
                          value={progress / 100}
                          aria-label={`Completion for ${game.title}`}
                        />
                      }
                      <span>
                        {progress}%
                        {log?.status === "Played" && log.completion ? ` · ${log.completion}` : ""}
                      </span>
                    </div>
                  ) : log?.status === "Played" && log.completion ? (
                    log.completion
                  ) : (
                    <span className="library-table-missing">Not recorded</span>
                  )}
                </td>
                <td>
                  {onOpenLog && (
                    <Button
                      size="sm"
                      aria-label={`Edit log for ${game.title}`}
                      onClick={() => onOpenLog(game.igdbId)}
                    >
                      <Edit3 size={16} />
                      Edit
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
