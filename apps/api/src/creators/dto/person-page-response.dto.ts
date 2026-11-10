import type {
  CreatorGroupDto,
  CreatorSeriesRefDto,
  CreatorWorkDto,
  PersonPageDto,
} from "@loomkeep/shared";
import {
  BookStatus,
  CreatorCreditKind,
  CreatorGroupKey,
  CreatorSource,
  Domain,
  EntryStatus,
  MediaType,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class CreatorSeriesRefResponseDto implements CreatorSeriesRefDto {
  key!: string;
  name!: string;
  position!: number;
}

export class CreatorWorkResponseDto implements CreatorWorkDto {
  @ApiProperty({ enum: [Domain.MEDIA, Domain.BOOKS] })
  domain!: "MEDIA" | "BOOKS";

  @ApiProperty({ enum: MediaType, nullable: true })
  type!: MediaType | null;

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

  @ApiProperty({ enum: CreatorCreditKind })
  kind!: CreatorCreditKind;

  editionCount!: number | null;
  series!: CreatorSeriesRefResponseDto | null;
  // A film's or a book's: the two status sets share most values.
  @ApiProperty({
    enum: [
      ...new Set([...Object.values(EntryStatus), ...Object.values(BookStatus)]),
    ],
    nullable: true,
  })
  status!: EntryStatus | BookStatus | null;
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
  rareCount!: number;
}
