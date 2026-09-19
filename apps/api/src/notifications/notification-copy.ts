import { Locale, type Locale as LocaleCode } from "@loomkeep/shared";

const COPY = {
  fr: {
    adminTestPush:
      "Ceci est une notification de test envoyée depuis le panel admin.",
    adminBroadcastPush:
      "Message envoyé à tous les comptes depuis le panel admin.",
    reportResolution: {
      title: "Ton signalement a été traité",
      resolved: "Une mesure a été prise suite à ton signalement.",
      dismissed: "Nous n'avons pas donné suite à ton signalement.",
    },
  },
  en: {
    adminTestPush: "This is a test notification sent from the admin panel.",
    adminBroadcastPush: "Message sent to all accounts from the admin panel.",
    reportResolution: {
      title: "Your report has been reviewed",
      resolved: "Action has been taken following your report.",
      dismissed: "We did not take further action on your report.",
    },
  },
} satisfies Record<
  LocaleCode,
  {
    adminTestPush: string;
    adminBroadcastPush: string;
    reportResolution: { title: string; resolved: string; dismissed: string };
  }
>;

export function notificationCopy(locale: string | undefined) {
  const resolved = Locale.includes(locale as LocaleCode)
    ? (locale as LocaleCode)
    : "fr";
  return COPY[resolved];
}
