// The settings information architecture, in one place: five groups, one
// route per section. The old single page kept a parallel `SECTIONS` array
// next to the markup that rendered it; here the same array drives the rail,
// the mobile index, the search and the legacy-anchor redirects, so a new
// section is added once.
import type { isFeatureNew } from "$lib/feature-badges";
import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";

type FeatureBadgeKey = Parameters<typeof isFeatureNew>[0];

/**
 * Below this many unused recovery codes, running out stops being a detail of
 * the 2FA screen and becomes an account-level warning — the settings layout
 * shows a banner on every section, not just the one you have to scroll to.
 */
export const RECOVERY_CODES_LOW_THRESHOLD = 2;

/** One searchable control inside a section — a row, a toggle, a field. */
export interface SettingsEntryDef {
  label: string;
  /**
   * Terms a user might type for this control that its label doesn't contain:
   * synonyms, the English word for a French label, the brand name of a
   * provider. Matching is accent- and case-insensitive.
   */
  keywords: string[];
}

export interface SettingsSectionDef {
  /** Route segment under `/app/settings`. */
  slug: string;
  label: string;
  icon: IconName;
  /** One line of what the section is for, shown under its title. */
  description: string;
  keywords: string[];
  entries: SettingsEntryDef[];
  /** Hidden when the deployment runs with social off. */
  social?: boolean;
  newBadgeKey?: FeatureBadgeKey;
  /** Styled as destructive in the rail and on the index. */
  danger?: boolean;
  /** The `#anchor` this section answered on before it had its own route. */
  legacyHash?: string;
}

export interface SettingsGroupDef {
  id: string;
  label: string;
  sections: SettingsSectionDef[];
}

export const SETTINGS_GROUPS: SettingsGroupDef[] = [
  {
    id: "account",
    label: m.settings_nav_group_account(),
    sections: [
      {
        slug: "securite",
        label: m.settings_nav_identifiers(),
        icon: "shield",
        description: m.settings_identifiers_description(),
        keywords: ["securite", "security", "compte", "account", "login"],
        legacyHash: "securite",
        entries: [
          {
            label: m.common_username(),
            keywords: ["pseudo", "handle", "identifiant"],
          },
          {
            label: m.common_email(),
            keywords: ["mail", "adresse", "verification"],
          },
          {
            label: m.common_password(),
            keywords: ["password", "mot de passe", "motdepasse"],
          },
        ],
      },
      {
        slug: "double-authentification",
        label: m.settings_section_mfa(),
        icon: "lock",
        description: m.settings_mfa_totp_desc(),
        keywords: ["2fa", "mfa", "totp", "otp", "authenticator"],
        newBadgeKey: "mfa",
        legacyHash: "mfa",
        entries: [
          {
            label: m.auth_mfa_totp_label(),
            keywords: ["totp", "authenticator", "aegis", "google"],
          },
          { label: m.auth_mfa_email_label(), keywords: ["code", "otp"] },
          {
            label: m.settings_mfa_webauthn_label(),
            keywords: ["webauthn", "passkey", "yubikey", "biometrie"],
          },
          {
            label: m.settings_mfa_passwordless_label(),
            keywords: ["passwordless", "sans mot de passe"],
          },
          {
            label: m.settings_mfa_recovery_title(),
            keywords: ["recovery", "secours", "backup"],
          },
        ],
      },
      {
        slug: "appareils",
        label: m.settings_sessions_title(),
        icon: "monitor",
        description: m.settings_sessions_description(),
        keywords: ["sessions", "devices", "deconnecter", "logout"],
        entries: [
          {
            label: m.settings_sessions_disconnect_all(),
            keywords: ["revoke", "deconnexion"],
          },
        ],
      },
      {
        slug: "suppression",
        label: m.settings_delete_account_button(),
        icon: "trash",
        description: m.settings_delete_account_description(),
        keywords: ["danger", "delete", "supprimer", "rgpd", "fermer"],
        danger: true,
        legacyHash: "danger",
        entries: [],
      },
    ],
  },
  {
    id: "privacy",
    label: m.settings_nav_group_privacy(),
    sections: [
      {
        slug: "confidentialite",
        label: m.settings_profile_visibility(),
        icon: "eye",
        description: m.settings_privacy_description(),
        keywords: ["privacy", "public", "prive", "fantome", "ghost"],
        social: true,
        legacyHash: "confidentialite",
        entries: [
          {
            label: m.settings_privacy_default_reviews(),
            keywords: ["avis", "notes", "reviews", "portee"],
          },
          {
            label: m.settings_hide_progression(),
            keywords: ["progression", "avancement", "masquer"],
          },
        ],
      },
      {
        slug: "contenu",
        label: m.settings_section_content(),
        icon: "eye-off",
        description: m.settings_birthdate_description(),
        keywords: ["contenu", "content", "age"],
        legacyHash: "contenu",
        entries: [
          {
            label: m.common_birthdate(),
            keywords: ["naissance", "birthday", "age", "date"],
          },
          {
            label: m.settings_adult_content_label(),
            keywords: ["adulte", "adult", "18", "nsfw", "hentai"],
          },
        ],
      },
    ],
  },
  {
    id: "app",
    label: m.settings_nav_group_app(),
    sections: [
      {
        slug: "apparence",
        label: m.settings_appearance_title(),
        icon: "sun",
        description: m.settings_appearance_description(),
        keywords: ["apparence", "appearance", "ui"],
        legacyHash: "apparence",
        entries: [
          {
            label: m.common_theme(),
            keywords: ["theme", "sombre", "clair", "dark", "light", "salle"],
          },
          {
            label: m.common_language(),
            keywords: ["langue", "language", "francais", "english", "locale"],
          },
          {
            label: m.settings_nav_style_label(),
            keywords: ["navigation", "rail", "marquee"],
          },
          {
            label: m.settings_mobile_nav_bar_label(),
            keywords: ["raccourcis", "shortcuts", "barre", "mobile"],
          },
        ],
      },
      {
        slug: "domaines",
        label: m.common_domains(),
        icon: "library",
        description: m.settings_domains_description(),
        keywords: [
          "domaines",
          "domains",
          "series",
          "films",
          "jeux",
          "livres",
          "musique",
        ],
        legacyHash: "domaines",
        entries: [],
      },
      {
        slug: "communications",
        label: m.settings_section_communications(),
        icon: "bell",
        description: m.settings_communications_email_desc(),
        keywords: ["notifications", "emails", "alertes"],
        newBadgeKey: "notification-digest",
        legacyHash: "communications",
        entries: [
          {
            label: m.common_timezone(),
            keywords: ["fuseau", "timezone", "heure", "horaire", "utc"],
          },
          {
            label: m.common_email(),
            keywords: ["resume", "digest", "episodes", "hebdo"],
          },
          {
            label: m.common_push_notifications(),
            keywords: ["push", "alerte", "notification"],
          },
          {
            label: m.common_newsletter(),
            keywords: ["newsletter", "nouveautes", "release"],
          },
        ],
      },
    ],
  },
  {
    id: "data",
    label: m.settings_nav_group_data(),
    sections: [
      {
        slug: "import",
        label: m.common_import(),
        icon: "download",
        description: m.settings_import_description(),
        keywords: [
          "import",
          "tv time",
          "trakt",
          "steam",
          "goodreads",
          "storygraph",
          "babelio",
          "myanimelist",
          "simkl",
        ],
        legacyHash: "import",
        entries: [],
      },
      {
        slug: "export",
        label: m.common_export(),
        icon: "archive",
        description: m.settings_export_body(),
        keywords: ["export", "json", "csv", "telecharger", "download", "rgpd"],
        legacyHash: "export",
        entries: [],
      },
    ],
  },
  {
    id: "loomkeep",
    label: m.settings_nav_group_loomkeep(),
    sections: [
      {
        slug: "aide",
        label: `${m.common_help()} & ${m.common_feedback()}`,
        icon: "question",
        description: m.settings_help_body(),
        keywords: ["aide", "help", "bug", "idee", "roadmap", "changelog"],
        legacyHash: "aide",
        entries: [
          { label: m.common_suggest_idea(), keywords: ["feature", "idee"] },
          { label: m.common_report_bug(), keywords: ["bug", "probleme"] },
          { label: m.settings_help_roadmap(), keywords: ["roadmap"] },
          { label: m.settings_help_changelog(), keywords: ["changelog"] },
        ],
      },
      {
        slug: "soutien",
        label: m.settings_section_support(),
        icon: "sparkles",
        description: m.settings_support_body(),
        keywords: ["don", "donate", "soutien", "support", "tip"],
        legacyHash: "soutien",
        entries: [],
      },
      {
        slug: "sources-donnees",
        label: m.settings_datasources_title(),
        icon: "database",
        description: m.settings_datasources_body(),
        keywords: [
          "sources",
          "tmdb",
          "anilist",
          "igdb",
          "open library",
          "musicbrainz",
          "omdb",
          "licences",
        ],
        legacyHash: "sources-donnees",
        entries: [],
      },
    ],
  },
];

export const SETTINGS_SECTIONS: SettingsSectionDef[] = SETTINGS_GROUPS.flatMap(
  (group) => group.sections,
);

export function sectionHref(slug: string): string {
  return `/app/settings/${slug}`;
}

export function findSection(slug: string): SettingsSectionDef | undefined {
  return SETTINGS_SECTIONS.find((section) => section.slug === slug);
}

/**
 * `#anchor` → route, for the links the single-page settings left behind:
 * verification emails, digest footers and the home screen all still point at
 * `/app/settings#aide`, and those are already out in inboxes.
 */
export const LEGACY_HASH_ROUTES: Record<string, string> = Object.fromEntries(
  SETTINGS_SECTIONS.filter((section) => section.legacyHash).map((section) => [
    section.legacyHash as string,
    sectionHref(section.slug),
  ]),
);
