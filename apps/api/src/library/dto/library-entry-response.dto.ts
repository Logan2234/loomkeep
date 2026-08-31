import type {
  EntryStatus,
  LibraryEntryDto,
  MediaOwnershipStatus,
} from "@loomkeep/shared";
import { MediaItemResponseDto } from "./media-item-response.dto";
import { MovieReplayResponseDto } from "./movie-replay-response.dto";
import { ProgressResponseDto } from "./progress-response.dto";

export class LibraryEntryResponseDto implements LibraryEntryDto {
  id!: string;
  mediaItem!: MediaItemResponseDto;
  status!: EntryStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
  lastWatchedAt!: string | null;
  progress!: ProgressResponseDto | null;
  ownershipStatus!: MediaOwnershipStatus;
  ownershipSource!: string | null;
  replays!: MovieReplayResponseDto[];
}
