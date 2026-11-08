import { useState, useId } from "react";
import { coverUrl, type RelatedGameSlim } from "../../types/gameDetail";
import { relatedYear, gameTypeLabel } from "../../services/relatedGames";
import { useRelatedLibrary, type RelatedLibrary } from "../../hooks/useRelatedLibrary";
import type { Status } from "../../types";
export function RelatedStrip({
  games,
  onGameClick,
  layout = "strip",
  library,
  yearLabel = "First release",
  listLabel = "Related games list",
}: {
  games: RelatedGameSlim[];
  onGameClick: (id: number) => void;
  layout?: "strip" | "grid" | "list";
  library?: RelatedLibrary;
  yearLabel?: string;
  listLabel?: string;
}) {
  const queriedLibrary = useRelatedLibrary(library);
  const membership = library ?? queriedLibrary;
  if (layout === "list")
    return (
      <div
        className="related-list-scroll"
        role="region"
        aria-label={`${listLabel}, scroll horizontally for more columns`}
        tabIndex={0}
      >
        <table className="related-list" aria-label={listLabel}>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Game type</th>
              <th scope="col">{yearLabel}</th>
              <th scope="col">Library</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>
                  <button
                    type="button"
                    className="related-title-button"
                    onClick={() => onGameClick(game.id)}
                  >
                    {game.name}
                  </button>
                </td>
                <td>{gameTypeLabel(game)}</td>
                <td>{relatedYear(game)}</td>
                <td>
                  {membership?.has(game.id)
                    ? `In library${membership.get(game.id) ? ` · ${membership.get(game.id)}` : ""}`
                    : membership
                      ? "Not in library"
                      : "Checking library…"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div
      role="list"
      aria-label="Related game results"
      className={layout === "grid" ? "detail-related-grid" : "detail-related-strip"}
    >
      {games.map((game) => (
        <div role="listitem" className="related-card-item" key={game.id}>
          <RelatedCard
            game={game}
            member={membership?.has(game.id) ?? false}
            status={membership?.get(game.id)}
            onClick={() => onGameClick(game.id)}
          />
        </div>
      ))}
    </div>
  );
}
function RelatedCard({
  game,
  onClick,
  member,
  status,
}: {
  game: RelatedGameSlim;
  onClick: () => void;
  member: boolean;
  status?: Status;
}) {
  const [failedImage, setFailedImage] = useState<string | undefined>(undefined),
    image = game.cover?.image_id,
    labelId = useId();
  return (
    <button
      type="button"
      className="detail-related-card"
      aria-label={game.name}
      aria-describedby={member ? labelId : undefined}
      title={game.name}
      onClick={onClick}
    >
      <span className="detail-related-cover">
        {image && failedImage !== image ? (
          <img
            key={image}
            src={coverUrl(image)}
            alt=""
            loading="lazy"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <span>{game.name}</span>
        )}
      </span>
      <strong>{game.name}</strong>
      <span className="related-card-year">{relatedYear(game)}</span>
      {member && (
        <span id={labelId} className="related-library-label">
          In library{status ? ` · ${status}` : ""}
        </span>
      )}
    </button>
  );
}
