import type { WidgetTokenDto } from "@loomkeep/shared/contracts";

export class WidgetTokenResponseDto implements WidgetTokenDto {
  ssoToken!: string;
}
