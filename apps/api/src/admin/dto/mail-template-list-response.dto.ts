import type {
  MailTemplateFieldDto,
  MailTemplateInfoDto,
  MailTemplateListResponseDto,
} from "@loomkeep/shared";

class MailTemplateFieldResponseDto implements MailTemplateFieldDto {
  key!: string;
  label!: string;
  default!: string;
  multiline?: boolean;
}

class MailTemplateInfoResponseDto implements MailTemplateInfoDto {
  key!: string;
  label!: string;
  fields!: MailTemplateFieldResponseDto[];
}

export class MailTemplateListResponseResponseDto implements MailTemplateListResponseDto {
  templates!: MailTemplateInfoResponseDto[];
  smtpConfigured!: boolean;
}
