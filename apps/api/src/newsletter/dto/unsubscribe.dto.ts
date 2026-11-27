import type { UnsubscribeNewsletterRequestDto } from "@loomkeep/shared/contracts";
import { IsString } from "class-validator";

export class UnsubscribeDto implements UnsubscribeNewsletterRequestDto {
  @IsString()
  token!: string;
}
