import { ModerationLegalBasis, ModerationMeasure } from "@loomkeep/shared";
import type { MailLayout } from "./mail-layout";
import { SECURITY_ALERT_EVENTS } from "./mail.i18n";
import type { GalleryTemplate, PausedReminderItem } from "./mail.types";
import {
  buildAccountDeleted,
  buildAccountDeletionCancelled,
  buildAccountDeletionReminder,
  buildAccountDeletionScheduled,
  buildEmailChangeCode,
  buildEmailChangedNew,
  buildEmailChangedOld,
  buildInactivityWarning,
  buildInvitation,
  buildMfaEmailCode,
  buildNewDeviceLogin,
  buildPasswordChanged,
  buildPasswordResetLink,
  buildSecurityAlert,
  buildVerifyEmail,
  buildWelcome,
} from "./templates/account";
import {
  buildAccessibilityReport,
  buildAdminNewUser,
  buildImportAlert,
  buildJobAlert,
  buildQuotaAlert,
  buildReportsDigest,
  buildUpdateAvailable,
} from "./templates/admin";
import {
  buildApiKeyCreated,
  buildApiKeyExpiring,
  buildApiKeyLeaked,
} from "./templates/api-keys";
import {
  buildEpisodeDigest,
  buildPausedReminder,
  buildSagaSequel,
} from "./templates/library";
import { buildModerationDecision } from "./templates/moderation";
import { buildNewsletter } from "./templates/newsletter";

/** The gallery's comma-separated measure field, unknown values dropped. */
function galleryMeasures(raw: string): ModerationMeasure[] {
  const known = Object.values(ModerationMeasure) as string[];
  const measures = raw
    .split(",")
    .map((m) => m.trim())
    .filter((m): m is ModerationMeasure => known.includes(m));
  return measures.length > 0 ? measures : [ModerationMeasure.COMMENT_REMOVED];
}

/**
 * Every template, keyed for the admin preview/test-send gallery. `fields`
 * describes the editable sample data (admin can override any of them to
 * test edge cases — long text, special characters…); `build` must render
 * without any live user/request context, since the gallery calls it out
 * of band with just those field values (defaults if not overridden).
 */
export function mailGallery(
  layout: MailLayout,
): Record<string, GalleryTemplate> {
  return {
    welcome: {
      label: "Bienvenue",
      fields: [{ key: "displayName", label: "Nom", default: "Alice" }],
      build: (locale, v) => buildWelcome(layout, locale, v.displayName),
    },
    verifyEmail: {
      label: "Confirmation d'email",
      fields: [
        { key: "token", label: "Token", default: "sample-verify-token" },
      ],
      build: (locale, v) => buildVerifyEmail(layout, locale, v.token),
    },
    invitation: {
      label: "Invitation à s'inscrire",
      fields: [
        { key: "inviter", label: "Invité par", default: "Logan" },
        { key: "token", label: "Token", default: "sample-invite-token" },
      ],
      build: (locale, v) =>
        buildInvitation(
          layout,
          locale,
          v.inviter || null,
          `${layout.webOrigin}/register?invite=${v.token}`,
          new Date(Date.now() + 7 * 24 * 60 * 60_000),
        ),
    },
    passwordResetLink: {
      label: "Lien de réinitialisation",
      fields: [{ key: "token", label: "Token", default: "sample-reset-token" }],
      build: (locale, v) => buildPasswordResetLink(layout, locale, v.token),
    },
    passwordChanged: {
      label: "Mot de passe modifié",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
      ],
      build: (locale, v) =>
        buildPasswordChanged(layout, locale, 0, new Date(v.occurredAt)),
    },
    emailChangedOld: {
      label: "Email modifié (ancienne adresse)",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "newEmail",
          label: "Nouvelle adresse",
          default: "nouvelle@example.com",
        },
      ],
      build: (locale, v) =>
        buildEmailChangedOld(
          layout,
          locale,
          v.newEmail,
          new Date(v.occurredAt),
        ),
    },
    emailChangedNew: {
      label: "Email modifié (nouvelle adresse)",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "oldEmail",
          label: "Ancienne adresse",
          default: "ancienne@example.com",
        },
      ],
      build: (locale, v) =>
        buildEmailChangedNew(
          layout,
          locale,
          v.oldEmail,
          new Date(v.occurredAt),
        ),
    },
    emailChangeCode: {
      label: "Code de confirmation d'email",
      fields: [{ key: "code", label: "Code", default: "482913" }],
      build: (locale, v) => buildEmailChangeCode(layout, locale, v.code),
    },
    mfaEmailCode: {
      label: "Code MFA (connexion)",
      fields: [{ key: "code", label: "Code", default: "482913" }],
      build: (locale, v) => buildMfaEmailCode(layout, locale, v.code),
    },
    newsletter: {
      label: "Newsletter (nouveautés)",
      fields: [
        {
          key: "title",
          label: "Titre",
          default: "Loomkeep 1.3.0",
        },
        {
          key: "content",
          label: "Contenu (Markdown, comme sur Quackback)",
          default:
            "Here's what's changing in this version.\n\n## New\n\n- Calendar subscription: subscribe to your Loomkeep release calendar from Google/Apple Calendar.\n- A feedback board! Suggest ideas and report bugs.\n\n## Improvements\n\n- Password strength requirements are now shown live while you type.",
          multiline: true,
        },
      ],
      // Sample token — the gallery renders out of band, with no real
      // recipient/subscription to mint one for. No real Quackback HTML to
      // preview here either, so this always exercises the Markdown fallback.
      build: (locale, v) =>
        buildNewsletter(
          layout,
          locale,
          v.title,
          v.content,
          "",
          "preview-token",
        ),
    },
    episodeDigest: {
      label: "Digest de sorties (email)",
      fields: [
        { key: "itemCount", label: "Nombre de sorties (1-6)", default: "1" },
        { key: "period", label: "Période (daily ou weekly)", default: "daily" },
      ],
      build: (locale, v) => {
        const count = Math.max(1, Math.min(6, Number(v.itemCount) || 1));
        // Episodes, a film and a game: the summary carries all three.
        const samples = [
          { title: "One Piece", body: "S1E1", url: "/app/media/anime/21" },
          {
            title: "Dune : Deuxième partie",
            body: "Sortie au cinéma · FR",
            url: "/app/media/movie/693134",
          },
          {
            title: "Grand Theft Auto VI",
            body: "Sortie du jeu",
            url: "/app/games/52189",
          },
          { title: "The Bear", body: "S3E2", url: "/app/media/series/136315" },
          { title: "Arcane", body: "S2E1", url: "/app/media/series/94605" },
          { title: "Severance", body: "S2E4", url: "/app/media/series/95396" },
        ];
        const items = samples.slice(0, count);
        return buildEpisodeDigest(
          layout,
          locale,
          items,
          v.period === "weekly" ? "weekly" : "daily",
        );
      },
    },
    quotaAlert: {
      label: "Alerte de quota fournisseur",
      fields: [
        { key: "provider", label: "Fournisseur", default: "OMDb" },
        { key: "count", label: "Appels du jour", default: "800" },
        { key: "limit", label: "Quota quotidien", default: "1000" },
      ],
      build: (locale, v) => {
        const limit = Number(v.limit) || 1000;
        const count = Number(v.count) || 0;
        return buildQuotaAlert(layout, locale, {
          provider: v.provider,
          count,
          limit,
          threshold: count / limit,
        });
      },
    },
    jobAlert: {
      label: "Alerte de job planifié",
      fields: [
        { key: "jobKey", label: "Job", default: "backup.run" },
        {
          key: "status",
          label: "Statut (FAILURE/SUCCESS)",
          default: "FAILURE",
        },
        {
          key: "error",
          label: "Erreur",
          default: "BACKUP_ENCRYPTION_PUBLIC_KEY is not set",
        },
      ],
      build: (locale, v) =>
        buildJobAlert(layout, locale, {
          jobKey: v.jobKey,
          error: v.status === "SUCCESS" ? null : v.error,
        }),
    },
    importAlert: {
      label: "Import en échec (admins)",
      fields: [
        { key: "source", label: "Source", default: "Letterboxd" },
        {
          key: "error",
          label: "Erreur",
          default: "TMDB request failed with status 503",
        },
      ],
      build: (locale, v) =>
        buildImportAlert(layout, locale, { source: v.source, error: v.error }),
    },
    reportsDigest: {
      label: "Digest des signalements",
      fields: [
        {
          key: "pendingCount",
          label: "Signalements en attente",
          default: "3",
        },
      ],
      build: (locale, v) =>
        buildReportsDigest(layout, locale, Number(v.pendingCount) || 0),
    },
    newDeviceLogin: {
      label: "Nouvelle connexion (appareil inconnu)",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "deviceLabel",
          label: "Appareil",
          default: "Chrome · Windows",
        },
        { key: "ip", label: "Adresse IP", default: "203.0.113.42" },
      ],
      build: (locale, v) =>
        buildNewDeviceLogin(
          layout,
          locale,
          v.deviceLabel,
          v.ip || null,
          new Date(v.occurredAt),
        ),
    },
    apiKeyExpiring: {
      label: "Clé API bientôt expirée",
      fields: [
        { key: "name", label: "Nom de la clé", default: "Script perso" },
        { key: "expiresAt", label: "Expiration", default: "2027-01-31" },
      ],
      build: (locale, v) =>
        buildApiKeyExpiring(layout, locale, v.name, new Date(v.expiresAt)),
    },
    sagaSequel: {
      label: "Suite de saga annoncée",
      fields: [
        { key: "title", label: "Œuvre annoncée", default: "Dune: Part Three" },
        { key: "saga", label: "Saga", default: "Dune Collection" },
        { key: "path", label: "Lien", default: "/app/media/movie/1170608" },
      ],
      build: (locale, v) =>
        buildSagaSequel(layout, locale, v.title, v.saga, v.path),
    },
    apiKeyCreated: {
      label: "Clé API créée",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        { key: "name", label: "Nom de la clé", default: "Script perso" },
      ],
      build: (locale, v) =>
        buildApiKeyCreated(layout, locale, v.name, new Date(v.occurredAt)),
    },
    apiKeyLeaked: {
      label: "Clé API trouvée en public",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        { key: "name", label: "Nom de la clé", default: "Script perso" },
        {
          key: "foundAt",
          label: "Où elle a été trouvée",
          default: "https://github.com/octocat/dotfiles/blob/main/.env",
        },
      ],
      build: (locale, v) =>
        buildApiKeyLeaked(
          layout,
          locale,
          v.name,
          v.foundAt || null,
          new Date(v.occurredAt),
        ),
    },
    securityAlert: {
      label: "Alerte de sécurité",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "event",
          label: "Événement (MFA_TOTP_DISABLED, MFA_CHALLENGE_LOCKED…)",
          default: "MFA_TOTP_DISABLED",
        },
      ],
      build: (locale, v) =>
        buildSecurityAlert(
          layout,
          locale,
          SECURITY_ALERT_EVENTS.find((event) => event === v.event) ??
            "MFA_TOTP_DISABLED",
          new Date(v.occurredAt),
        ),
    },
    accountDeleted: {
      label: "Compte supprimé",
      fields: [
        { key: "reason", label: "Raison (self ou inactive)", default: "self" },
      ],
      build: (locale, v) =>
        buildAccountDeleted(
          layout,
          locale,
          v.reason === "inactive" ? "inactive" : "self",
        ),
    },
    accountDeletionScheduled: {
      label: "Suppression de compte programmée",
      fields: [
        {
          key: "scheduledFor",
          label: "Date de suppression",
          default: "2026-11-03T05:15:00Z",
        },
      ],
      build: (locale, v) =>
        buildAccountDeletionScheduled(
          layout,
          locale,
          new Date(v.scheduledFor),
          "preview-token",
        ),
    },
    accountDeletionReminder: {
      label: "Rappel avant suppression (48 h)",
      fields: [
        {
          key: "scheduledFor",
          label: "Date de suppression",
          default: "2026-11-03T05:15:00Z",
        },
      ],
      build: (locale, v) =>
        buildAccountDeletionReminder(layout, locale, new Date(v.scheduledFor)),
    },
    accountDeletionCancelled: {
      label: "Suppression annulée par un admin",
      fields: [],
      build: (locale) => buildAccountDeletionCancelled(layout, locale),
    },
    updateAvailable: {
      label: "Mise à jour disponible (admins)",
      fields: [
        { key: "current", label: "Version installée", default: "1.11.0" },
        { key: "latest", label: "Version publiée", default: "1.12.0" },
      ],
      build: (locale, v) =>
        buildUpdateAvailable(layout, locale, v.current, v.latest),
    },
    pausedReminder: {
      label: "Rappel des œuvres en pause",
      fields: [
        { key: "itemCount", label: "Nombre d'œuvres (1-3)", default: "3" },
      ],
      build: (locale, v) => {
        const samples: PausedReminderItem[] = [
          {
            title: "Severance",
            url: "/app/media/series/95396",
            episodesLeft: 2,
            pagesLeft: null,
            pausedDays: 36,
            releasedSince: 4,
          },
          {
            title: "Dune",
            url: "/app/books/OL893415W",
            episodesLeft: null,
            pagesLeft: 68,
            pausedDays: 64,
            releasedSince: 0,
          },
          {
            title: "Hades",
            url: "/app/games/113112",
            episodesLeft: null,
            pagesLeft: null,
            pausedDays: 95,
            releasedSince: 0,
          },
        ];
        const count = Math.max(1, Math.min(3, Number(v.itemCount) || 3));
        return buildPausedReminder(layout, locale, samples.slice(0, count));
      },
    },
    adminNewUser: {
      label: "Nouvelle inscription (admins)",
      fields: [{ key: "name", label: "Nom affiché", default: "Alice" }],
      build: (locale, v) => buildAdminNewUser(layout, locale, v.name),
    },
    accessibilityReport: {
      label: "Obstacle d'accessibilité signalé (support)",
      fields: [
        {
          key: "message",
          label: "Message",
          default:
            "Le bouton « Ajouter » de la recherche n'a pas de nom pour TalkBack.",
        },
        { key: "page", label: "Page", default: "/app/search" },
        { key: "email", label: "Adresse", default: "alex@example.com" },
      ],
      build: (locale, v) =>
        buildAccessibilityReport(layout, locale, {
          message: v.message,
          page: v.page || undefined,
          email: v.email || undefined,
        }),
    },
    inactivityWarning: {
      label: "Relance compte inactif",
      fields: [
        {
          key: "deletionDate",
          label: "Date de suppression prévue",
          default: "2028-08-15",
        },
      ],
      build: (locale, v) =>
        buildInactivityWarning(layout, locale, new Date(v.deletionDate)),
    },
    moderationDecision: {
      label: "Décision de modération (DSA art. 17)",
      fields: [
        {
          key: "decisionId",
          label: "Decision reference",
          default: "decision-example",
        },
        {
          key: "decidedAt",
          label: "Decision date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "measure",
          label:
            "Mesures, séparées par des virgules (COMMENT_REMOVED, MESSAGE_REMOVED, REVIEW_REMOVED, LIST_REMOVED, LIST_EDITED, AVATAR_REMOVED, BIO_CLEARED, DISPLAY_NAME_CHANGED, ACCOUNT_SUSPENDED ou ACCOUNT_DELETED)",
          default: "COMMENT_REMOVED",
        },
        {
          key: "suspendedUntil",
          label: "Fin de la désactivation (ACCOUNT_SUSPENDED)",
          default: "2026-10-10T14:20:00Z",
        },
        {
          key: "legalBasis",
          label: "Base (ILLEGAL_CONTENT ou TOS_BREACH)",
          default: "TOS_BREACH",
        },
        {
          key: "reasonText",
          label: "Faits retenus",
          default: "Propos insultants répétés envers un autre utilisateur.",
          multiline: true,
        },
        {
          key: "tosClause",
          label: "Clause CGU / fondement",
          default: "§7 — Règles de conduite",
        },
      ],
      build: (locale, v) =>
        buildModerationDecision(layout, locale, {
          measures: galleryMeasures(v.measure),
          suspendedUntil: new Date(v.suspendedUntil),
          legalBasis:
            v.legalBasis === ModerationLegalBasis.ILLEGAL_CONTENT
              ? ModerationLegalBasis.ILLEGAL_CONTENT
              : ModerationLegalBasis.TOS_BREACH,
          reasonText: v.reasonText,
          tosClause: v.tosClause,
          decisionIds: [v.decisionId],
          decidedAt: new Date(v.decidedAt),
        }),
    },
  };
}
