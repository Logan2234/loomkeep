import type { MailTemplatePreviewDto } from "@loomkeep/shared";

export class MailTemplatePreviewResponseDto implements MailTemplatePreviewDto {
  subject!: string;
  html!: string;
  text!: string;
}
