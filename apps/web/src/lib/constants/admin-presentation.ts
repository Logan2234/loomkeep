import { m } from "$lib/paraglide/messages.js";
import type { ServiceArea, ServiceStatusDto } from "@loomkeep/shared";

// These French strings are wire identifiers in ServiceArea, not display labels.
const AREA_LABELS = {
  Vidéo: () => m.common_Media(),
  Jeux: () => m.common_Games(),
  Livres: () => m.common_Books(),
  Musique: () => m.common_Music(),
  Podcasts: () => m.common_Podcasts(),
  "Jeux de société": () => m.common_Boardgames(),
  Système: () => m.common_system(),
} satisfies Record<ServiceArea, () => string>;

export function groupAdminServices(services: ServiceStatusDto[]) {
  return (Object.keys(AREA_LABELS) as ServiceArea[])
    .map((area) => ({
      area,
      label: AREA_LABELS[area](),
      items: services.filter((service) => service.area === area),
    }))
    .filter((group) => group.items.length > 0);
}

export function adminServiceLabel(key: string, label: string): string {
  // The statistics endpoint exposes this provider's legacy label without its key.
  return key === "omdb" || label === "OMDb (notes)"
    ? m.admin_service_omdb()
    : label;
}

export function adminServiceDetail(service: ServiceStatusDto): string | null {
  if (service.comingSoon) return null;
  if (!service.configured) return m.admin_service_missing_key();
  if (service.reachable === false) return m.admin_service_unreachable();
  return null;
}

const JOB_LABELS = {
  "notifications.scan": () => m.admin_job_notifications_scan(),
  "notifications.digest": () => m.admin_job_notifications_digest(),
  "media.refreshStale": () => m.admin_job_media_refresh(),
  "reports.digest": () => m.admin_job_reports_digest(),
  "backup.run": () => m.admin_job_backup(),
  "users.inactiveAccountsScan": () => m.admin_job_inactive_accounts(),
};

export function adminJobLabel(key: string): string {
  return Object.hasOwn(JOB_LABELS, key)
    ? JOB_LABELS[key as keyof typeof JOB_LABELS]()
    : key;
}

export function adminJobSchedule(key: string): string | null {
  switch (key) {
    case "notifications.scan":
      return m.admin_job_hourly();
    case "notifications.digest":
      return m.admin_job_digest_schedule();
    case "media.refreshStale":
      return m.admin_job_every_hours({ hours: 6 });
    case "reports.digest":
      return m.admin_job_daily_at({ time: "07:00" });
    case "backup.run":
      return m.admin_job_daily_at({ time: "03:00" });
    case "users.inactiveAccountsScan":
      return m.admin_job_daily_at({ time: "05:00" });
    default:
      return null;
  }
}

// Gallery controls only: generated email bodies and sample values belong to the backend.
const TEMPLATE_LABELS = {
  welcome: () => m.common_welcome(),
  verifyEmail: () => m.admin_template_verify_email(),
  passwordResetLink: () => m.admin_template_reset_link(),
  passwordChanged: () => m.admin_template_password_changed(),
  emailChangedOld: () => m.admin_template_email_changed_old(),
  emailChangedNew: () => m.admin_template_email_changed_new(),
  emailChangeCode: () => m.admin_template_email_code(),
  mfaEmailCode: () => m.admin_template_mfa_code(),
  newsletter: () => m.common_newsletter(),
  episodeDigest: () => m.admin_template_episode_digest(),
  reportsDigest: () => m.admin_job_reports_digest(),
  newDeviceLogin: () => m.admin_security_new_device(),
  inactivityWarning: () => m.admin_template_inactivity(),
  moderationDecision: () => m.admin_template_moderation(),
};
const FIELD_LABELS = {
  displayName: () => m.common_name(),
  token: () => m.common_token(),
  newEmail: () => m.settings_new_email_label(),
  oldEmail: () => m.common_old_email(),
  code: () => m.common_code(),
  title: () => m.common_title(),
  content: () => m.admin_template_content(),
  itemCount: () => m.admin_template_episode_count(),
  period: () => m.admin_template_period(),
  pendingCount: () => m.admin_stats_kpi_pending_reports(),
  deviceLabel: () => m.common_device(),
  ip: () => m.common_ip_address(),
  deletionDate: () => m.admin_template_deletion_date(),
  measure: () => m.admin_template_measure(),
  legalBasis: () => m.admin_template_basis(),
  reasonText: () => m.admin_moderation_facts(),
  tosClause: () => m.admin_moderation_terms_clause(),
};

export function adminTemplateLabel(key: string): string {
  return Object.hasOwn(TEMPLATE_LABELS, key)
    ? TEMPLATE_LABELS[key as keyof typeof TEMPLATE_LABELS]()
    : key;
}

export function adminTemplateFieldLabel(key: string): string {
  return Object.hasOwn(FIELD_LABELS, key)
    ? FIELD_LABELS[key as keyof typeof FIELD_LABELS]()
    : key;
}
