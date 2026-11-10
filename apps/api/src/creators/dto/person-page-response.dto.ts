import type {
  CreatorGroupDto,
  CreatorWorkDto,
  EntryStatus,
  MediaType,
  PersonPageDto,
} from "@loomkeep/shared";
import { CreatorGroupKey, CreatorSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class CreatorWorkResponseDto implements CreatorWorkDto {
  type!: MediaType;
  sourceId!: string;
  title!: string;
  year!: number | null;
  releaseDate!: string | null;
  posterUrl!: string | null;
  isAdult!: boolean;
  jobs!: string[];
  character!: string | null;
  episodeCount!: number | null;
  genreIds!: number[];
  upcoming!: boolean;
  status!: EntryStatus | null;
}

export class CreatorGroupResponseDto implements CreatorGroupDto {
  @ApiProperty({ enum: CreatorGroupKey })
  key!: CreatorGroupKey;

  works!: CreatorWorkResponseDto[];
}

export class PersonPageResponseDto implements PersonPageDto {
  @ApiProperty({ enum: CreatorSource })
  source!: CreatorSource;

  id!: string;
  name!: string;
  photoUrl!: string | null;
  description!: string | null;
  birthday!: string | null;
  deathday!: string | null;
  placeOfBirth!: string | null;

  @ApiProperty({ enum: CreatorGroupKey, nullable: true })
  knownFor!: CreatorGroupKey | null;

  alsoKnownAs!: string[];
  imdbId!: string | null;
  wikidataId!: string | null;
  homepage!: string | null;
  groups!: CreatorGroupResponseDto[];
}
