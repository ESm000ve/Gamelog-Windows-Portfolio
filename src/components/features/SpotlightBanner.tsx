import { useState } from "react";
import { Button } from "../ui/Button";
import { useLiveQuery } from "dexie-react-hooks";
import { Calendar, ArrowRight, ChevronDown } from "../icons";
import { Link } from "react-router-dom";
import { getSpotlight } from "../../services/spotlight";
import "./SpotlightBanner.css";

export function SpotlightBanner() {
  const [expanded, setExpanded] = useState(false);
  const spotlight = useLiveQuery(() => getSpotlight().catch(() => null));

  if (!spotlight) return null;

  return (
    <section className="library-weekly-pick">
      <Button
        variant="ghost"
        className="library-weekly-summary"
        aria-label={`Game of the week: ${spotlight.game.title}`}
        aria-expanded={expanded}
        aria-controls="library-weekly-details"
        onClick={() => setExpanded(!expanded)}
      >
        <Calendar size={16} aria-hidden="true" />
        <span>Game of the week</span>
        <strong>{spotlight.game.title}</strong>
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{ marginLeft: "auto", transform: expanded ? "rotate(180deg)" : undefined }}
        />
      </Button>
      {expanded && (
        <Link
          id="library-weekly-details"
          aria-label={`View weekly pick: ${spotlight.game.title}`}
          to={`/game/${spotlight.game.igdbId}`}
          className="library-weekly-details"
        >
          <div className="library-weekly-pick-cover">
            {spotlight.game.coverUrl && <img src={spotlight.game.coverUrl} alt="" />}
          </div>

          <div className="library-weekly-pick-body">
            <h2 className="library-weekly-pick-title">{spotlight.game.title}</h2>
            <p className="library-weekly-pick-reason">{spotlight.reason}</p>
          </div>

          <div className="library-weekly-pick-arrow">
            <ArrowRight size={16} />
          </div>
        </Link>
      )}
    </section>
  );
}
