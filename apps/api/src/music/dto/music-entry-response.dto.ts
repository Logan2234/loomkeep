import type {
  MusicEntryDto,
  MusicOwnershipStatus,
  MusicStatus,
} from "@loomkeep/shared";
import { MusicItemResponseDto } from "./music-item-response.dto";

export class MusicEntryResponseDto implements MusicEntryDto {
  id!: string;
  album!: MusicItemResponseDto;
  status!: MusicStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  ownershipStatus!: MusicOwnershipStatus;
  ownershipSource!: string | null;
}
