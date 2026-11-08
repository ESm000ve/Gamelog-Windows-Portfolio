import { useState } from "react";
import type { Game } from "../../types";
export function PlayCover({ game }: { game: Game }) {
  const [failed, setFailed] = useState<string | undefined>();
  return game.coverUrl && failed !== game.coverUrl ? (
    <img src={game.coverUrl} alt="" onError={() => setFailed(game.coverUrl)} />
  ) : (
    <span className="recommend-cover-fallback">{game.title}</span>
  );
}
