import type { TotpSetupDto } from "@loomkeep/shared";

export class TotpSetupResponseDto implements TotpSetupDto {
  otpauthUri!: string;
  secret!: string;
}
