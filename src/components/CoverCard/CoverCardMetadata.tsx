import { Badge } from "@fluentui/react-components";
import { gameStatusLabel } from "../../services/gameStatus";
import { Star } from "../icons";
import { StarRating } from "../ui/StarRating";
import type { Status, Completion } from "../../types";
import { shortPlatform } from "../../utils/platforms";
import "./CoverCardMetadata.css";

interface CoverCardMetadataProps {
  platform?: string;
  releaseYear?: number;
  status?: Status;
  completion?: Completion;
  rating?: number;
}

export function CoverCardMetadata({
  platform,
  releaseYear,
  status,
  completion,
  rating,
}: CoverCardMetadataProps) {
  const label = status ? gameStatusLabel(status, completion) : undefined;
  return (
    <div className="card-metadata">
      {/* Row 1: System + Year */}
      <div className="card-metadata-platform">
        {[shortPlatform(platform), releaseYear].filter(Boolean).join(" · ")}
      </div>

      {/* Row 2: Status & Rating */}
      <div className="card-metadata-row">
        {status && label ? (
          <Badge
            appearance="tint"
            shape="rounded"
            size="medium"
            color={
              label === "Completed" || label === "Mastered"
                ? "success"
                : status === "Playing"
                  ? "brand"
                  : "subtle"
            }
          >
            {label}
          </Badge>
        ) : (
          <div />
        )}

        {typeof rating === "number" ? (
          <div className="card-metadata-rating">
            <StarRating rating={rating} size={12} showValue={true} />
          </div>
        ) : (
          <div className="card-metadata-rating" aria-label="Not rated">
            <Star size={12} aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
