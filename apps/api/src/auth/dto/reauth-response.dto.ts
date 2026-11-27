import type {
  ReauthMethod,
  ReauthResultDto,
  ReauthStatusDto,
} from "@loomkeep/shared/contracts";

export class ReauthStatusResponseDto implements ReauthStatusDto {
  methods!: ReauthMethod[];
  confirmedUntil!: string | null;
}

export class ReauthResultResponseDto implements ReauthResultDto {
  confirmedUntil!: string;
}
