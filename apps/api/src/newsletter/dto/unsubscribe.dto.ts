import { IsString } from "class-validator";
import type { UnsubscribeNewsletterRequestDto } from "@loomkeep/shared";

export class UnsubscribeDto implements UnsubscribeNewsletterRequestDto {
  @IsString()
  token!: string;
}
