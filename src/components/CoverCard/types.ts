import type { Status, Completion } from "../../types";

export interface CoverCardGame {
  igdbId: number;
  title: string;
  status?: Status;
  completion?: Completion;
  rating?: number;
  coverUrl?: string;
  coverColor?: string;
  platform?: string;
  releaseYear?: number;
  firstReleaseDate?: number;
  completionPercentage?: number;
  dealPrice?: number;
  dealUrl?: string;
}

export interface CoverCardProps {
  game: CoverCardGame;
  onClick?: (igdbId: number) => void;
  onChangeStatus?: (igdbId: number, status: Status) => void;
  onRate?: (igdbId: number, rating: number) => void;
  onLog?: (igdbId: number) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (igdbId: number, e: React.MouseEvent) => void;
  tabIndex?: number;
}
