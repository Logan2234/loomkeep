import type { CopyLocale } from "../../common/copy-locale.util";
import { EN_COPY } from "./en";
import { FR_COPY } from "./fr";
import { IT_COPY } from "./it";
import type { MailCopy } from "./types";

export { SECURITY_ALERT_EVENTS } from "./types";
export type { MailCopy, SecurityAlertEvent } from "./types";
export const MAIL_COPY: Record<CopyLocale, MailCopy> = {
  fr: FR_COPY,
  en: EN_COPY,
  it: IT_COPY,
};
