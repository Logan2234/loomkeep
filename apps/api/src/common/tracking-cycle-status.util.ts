import {
  BookStatus,
  GameStatus,
  type TrackingCycleStatus,
} from "@loomkeep/shared";

export const GAME_STATUS_BY_CYCLE: Record<TrackingCycleStatus, GameStatus> = {
  ACTIVE: GameStatus.PLAYING,
  COMPLETED: GameStatus.COMPLETED,
  DROPPED: GameStatus.DROPPED,
};

export const BOOK_STATUS_BY_CYCLE: Record<TrackingCycleStatus, BookStatus> = {
  ACTIVE: BookStatus.READING,
  COMPLETED: BookStatus.READ,
  DROPPED: BookStatus.DROPPED,
};
