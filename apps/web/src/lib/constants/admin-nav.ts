import { m } from "#lib/paraglide/messages.js";
import type Icon from "#lib/ui/Icon.svelte";
import type { ComponentProps } from "svelte";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: ComponentProps<typeof Icon>["name"];
  match: (path: string) => boolean;
  devOnly?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/app/admin/services",
    get label() {
      return m.admin_services_title();
    },
    get description() {
      return m.admin_nav_services_description();
    },
    icon: "monitor",
    match: (p) => p.startsWith("/app/admin/services"),
  },
  {
    href: "/app/admin/users",
    get label() {
      return m.common_users();
    },
    get description() {
      return m.admin_nav_users_description();
    },
    icon: "user",
    match: (p) => p.startsWith("/app/admin/users"),
  },
  {
    href: "/app/admin/communications",
    get label() {
      return m.settings_section_communications();
    },
    get description() {
      return m.admin_nav_communications_description();
    },
    icon: "mail",
    match: (p) => p.startsWith("/app/admin/communications"),
  },
  {
    href: "/app/admin/stats",
    get label() {
      return m.common_stats();
    },
    get description() {
      return m.admin_nav_stats_description();
    },
    icon: "stats",
    match: (p) => p.startsWith("/app/admin/stats"),
  },
  {
    href: "/app/admin/settings",
    get label() {
      return m.admin_settings_title();
    },
    get description() {
      return m.admin_nav_settings_description();
    },
    icon: "gear",
    match: (p) => p.startsWith("/app/admin/settings"),
  },
  {
    href: "/app/admin/jobs",
    get label() {
      return m.admin_jobs_title();
    },
    get description() {
      return m.admin_nav_jobs_description();
    },
    icon: "calendar",
    match: (p) => p.startsWith("/app/admin/jobs"),
  },
  {
    href: "/app/admin/backup",
    get label() {
      return m.admin_backup_title();
    },
    get description() {
      return m.admin_nav_backup_description();
    },
    icon: "archive",
    match: (p) => p.startsWith("/app/admin/backup"),
  },
  {
    href: "/app/admin/imports",
    get label() {
      return m.admin_imports_title();
    },
    get description() {
      return m.admin_nav_imports_description();
    },
    icon: "download",
    match: (p) => p.startsWith("/app/admin/imports"),
  },
  {
    href: "/app/admin/cache",
    get label() {
      return m.admin_cache_title();
    },
    get description() {
      return m.admin_nav_cache_description();
    },
    icon: "database",
    match: (p) => p.startsWith("/app/admin/cache"),
  },
  {
    href: "/app/admin/schema",
    get label() {
      return m.admin_schema_title();
    },
    get description() {
      return m.admin_nav_schema_description();
    },
    icon: "library",
    match: (p) => p.startsWith("/app/admin/schema"),
    devOnly: true,
  },
  {
    href: "/app/admin/components",
    get label() {
      return m.admin_components_title();
    },
    get description() {
      return m.admin_nav_components_description();
    },
    icon: "compass",
    match: (p) => p.startsWith("/app/admin/components"),
    devOnly: true,
  },
  {
    href: "/app/admin/security",
    get label() {
      return m.common_security();
    },
    get description() {
      return m.admin_nav_security_description();
    },
    icon: "shield",
    match: (p) => p.startsWith("/app/admin/security"),
  },
  {
    href: "/app/admin/newsletter",
    get label() {
      return m.common_newsletter();
    },
    get description() {
      return m.admin_nav_newsletter_description();
    },
    icon: "send",
    match: (p) => p.startsWith("/app/admin/newsletter"),
  },
  {
    href: "/app/admin/reports",
    get label() {
      return m.admin_social_reports_title();
    },
    get description() {
      return m.admin_nav_reports_description();
    },
    icon: "flag",
    match: (p) => p.startsWith("/app/admin/reports"),
  },
];

function itemsFor(hrefs: string[]): AdminNavItem[] {
  return hrefs.map((href) => {
    const item = ADMIN_NAV.find((candidate) => candidate.href === href);
    if (!item) throw new Error(`Unknown admin navigation destination: ${href}`);
    return item;
  });
}

export const ADMIN_NAV_GROUPS = [
  {
    get label() {
      return m.admin_group_pilotage();
    },
    items: itemsFor([
      "/app/admin/services",
      "/app/admin/jobs",
      "/app/admin/stats",
      "/app/admin/settings",
    ]),
  },
  {
    get label() {
      return m.admin_group_people();
    },
    items: itemsFor([
      "/app/admin/users",
      "/app/admin/communications",
      "/app/admin/newsletter",
    ]),
  },
  {
    get label() {
      return m.admin_group_moderation();
    },
    items: itemsFor(["/app/admin/reports", "/app/admin/security"]),
  },
  {
    get label() {
      return m.admin_group_maintenance();
    },
    items: itemsFor([
      "/app/admin/backup",
      "/app/admin/imports",
      "/app/admin/cache",
    ]),
  },
  {
    get label() {
      return m.admin_group_development();
    },
    items: itemsFor(["/app/admin/schema", "/app/admin/components"]),
  },
];

export const VISIBLE_ADMIN_NAV_GROUPS = ADMIN_NAV_GROUPS.map((group) => ({
  // A getter, not a spread: spreading would read the label once, at import.
  get label() {
    return group.label;
  },
  items: group.items.filter((item) => !item.devOnly || import.meta.env.DEV),
})).filter((group) => group.items.length > 0);
