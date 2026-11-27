export interface MailInbox {
  name: string;
  url: string;
}

const GMAIL = { name: "Gmail", url: "https://mail.google.com/" };
const OUTLOOK = { name: "Outlook", url: "https://outlook.live.com/mail/" };
const YAHOO = { name: "Yahoo Mail", url: "https://mail.yahoo.com/" };
const PROTON = { name: "Proton Mail", url: "https://mail.proton.me/" };
const ICLOUD = { name: "iCloud Mail", url: "https://www.icloud.com/mail" };

// Only webmails whose address is stable and public: an unknown domain shows
// no button rather than a guess.
const INBOXES: Record<string, MailInbox> = {
  "gmail.com": GMAIL,
  "googlemail.com": GMAIL,
  "outlook.com": OUTLOOK,
  "outlook.fr": OUTLOOK,
  "hotmail.com": OUTLOOK,
  "hotmail.fr": OUTLOOK,
  "live.com": OUTLOOK,
  "live.fr": OUTLOOK,
  "msn.com": OUTLOOK,
  "yahoo.com": YAHOO,
  "yahoo.fr": YAHOO,
  "ymail.com": YAHOO,
  "proton.me": PROTON,
  "protonmail.com": PROTON,
  "pm.me": PROTON,
  "icloud.com": ICLOUD,
  "me.com": ICLOUD,
  "mac.com": ICLOUD,
  "orange.fr": { name: "Mail Orange", url: "https://mail.orange.fr/" },
  "wanadoo.fr": { name: "Mail Orange", url: "https://mail.orange.fr/" },
  "sfr.fr": { name: "SFR Mail", url: "https://webmail.sfr.fr/" },
  "free.fr": { name: "Free Webmail", url: "https://webmail.free.fr/" },
};

/** The webmail behind an address, when its domain is a well-known one. */
export function mailInboxFor(email: string): MailInbox | null {
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  return INBOXES[domain] ?? null;
}
