import type { MailTemplatePreviewDto } from "@loomkeep/shared/contracts";

export class MailTemplatePreviewResponseDto implements MailTemplatePreviewDto {
  subject!: string;
  html!: string;
  text!: string;
}
