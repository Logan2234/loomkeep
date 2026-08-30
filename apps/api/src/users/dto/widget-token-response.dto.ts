import type { WidgetTokenDto } from "@loomkeep/shared";

export class WidgetTokenResponseDto implements WidgetTokenDto {
  ssoToken!: string;
}
