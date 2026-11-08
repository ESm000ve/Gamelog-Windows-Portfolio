import { Star, StarHalf } from "../icons";
import "./StarRating.css";

// ─── Display-only variant ─────────────────────────────────────────────────────

interface StarRatingDisplayProps {
  /** 0–5 in 0.5 steps */
  rating: number;
  /** Icon size in px. Default 11 */
  size?: number;
  /** Show numeric value beside stars. Default true */
  showValue?: boolean;
}

export function StarRating({ rating, size = 11, showValue = true }: StarRatingDisplayProps) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span role="img" className="star-rating" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star
          key={`f${i}`}
          size={size}
          fill="var(--app-yellow)"
          stroke="none"
          aria-hidden="true"
        />
      ))}
      {half && <StarHalf size={size} fill="var(--app-yellow)" stroke="none" aria-hidden="true" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star
          key={`e${i}`}
          size={size}
          fill="none"
          stroke="var(--app-tertiary-label)"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
      {showValue && (
        <span className="star-rating-value" style={{ fontSize: size - 1 }}>
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}

// ─── Interactive variant (used in Log Editor) ─────────────────────────────────

interface StarRatingInputProps {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}

export function StarRatingInput({ value, onChange, size = 26 }: StarRatingInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    const current = value || 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, current + 0.5);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0.5, current - 0.5);
    else if (e.key === "Home") next = 0.5;
    else if (e.key === "End") next = 5;

    if (next !== null) {
      e.preventDefault();
      onChange(next);
    }
  };

  return (
    <div
      role="slider"
      aria-label="Rating"
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value || 0}
      aria-valuetext={`${value || 0} stars`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="star-rating-input"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="star-rating-input-star">
          {([0.5, 1] as const).map((offset) => {
            const val = n - 1 + offset;
            const filled = (value || 0) >= val;
            return (
              <div
                key={offset}
                onClick={() => onChange(val)}
                className="star-rating-input-half"
                style={{ width: size / 2, height: size }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox="0 0 30 26"
                  style={{ marginLeft: offset === 0.5 ? 0 : -(size / 2) }}
                  aria-hidden="true"
                >
                  <polygon
                    points="15,2 18.5,11 27,12 21,18 23,26 15,22 7,26 9,18 3,12 11.5,11"
                    fill={filled ? "var(--app-yellow)" : "none"}
                    stroke={filled ? "var(--app-yellow)" : "var(--app-tertiary-label)"}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            );
          })}
        </span>
      ))}
    </div>
  );
}
