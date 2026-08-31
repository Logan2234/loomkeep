import type { MailTemplateListResponseDto } from "@loomkeep/shared";

class MailTemplateFieldResponseDto {
  key!: string;
  label!: string;
  default!: string;
  multiline?: boolean;
}

class MailTemplateInfoResponseDto {
  key!: string;
  label!: string;
  fields!: MailTemplateFieldResponseDto[];
}

export class MailTemplateListResponseResponseDto implements MailTemplateListResponseDto {
  templates!: MailTemplateInfoResponseDto[];
  smtpConfigured!: boolean;
}
