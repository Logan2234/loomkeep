import type { TotpSetupDto } from "@loomkeep/shared/contracts";

export class TotpSetupResponseDto implements TotpSetupDto {
  otpauthUri!: string;
  secret!: string;
}
