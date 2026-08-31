import type Icon from "$lib/components/Icon.svelte";
import { m } from "$lib/paraglide/messages";
import type { ComponentProps } from "svelte";

type AdminNavItem = {
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
    label: m.admin_services_title(),
    description: m.admin_nav_services_description(),
    icon: "monitor",
    match: (p) => p.startsWith("/app/admin/services"),
  },
  {
    href: "/app/admin/users",
    label: m.common_users(),
    description: m.admin_nav_users_description(),
    icon: "user",
    match: (p) => p.startsWith("/app/admin/users"),
  },
  {
    href: "/app/admin/communications",
    label: m.settings_section_communications(),
    description: m.admin_nav_communications_description(),
    icon: "mail",
    match: (p) => p.startsWith("/app/admin/communications"),
  },
  {
    href: "/app/admin/stats",
    label: m.common_stats(),
    description: m.admin_nav_stats_description(),
    icon: "stats",
    match: (p) => p.startsWith("/app/admin/stats"),
  },
  {
    href: "/app/admin/jobs",
    label: m.admin_jobs_title(),
    description: m.admin_nav_jobs_description(),
    icon: "calendar",
    match: (p) => p.startsWith("/app/admin/jobs"),
  },
  {
    href: "/app/admin/backup",
    label: m.admin_backup_title(),
    description: m.admin_nav_backup_description(),
    icon: "archive",
    match: (p) => p.startsWith("/app/admin/backup"),
  },
  {
    href: "/app/admin/imports",
    label: m.admin_imports_title(),
    description: m.admin_nav_imports_description(),
    icon: "download",
    match: (p) => p.startsWith("/app/admin/imports"),
  },
  {
    href: "/app/admin/cache",
    label: m.admin_cache_title(),
    description: m.admin_nav_cache_description(),
    icon: "database",
    match: (p) => p.startsWith("/app/admin/cache"),
  },
  {
    href: "/app/admin/schema",
    label: m.admin_schema_title(),
    description: m.admin_nav_schema_description(),
    icon: "library",
    match: (p) => p.startsWith("/app/admin/schema"),
    devOnly: true,
  },
  {
    href: "/app/admin/security",
    label: m.common_security(),
    description: m.admin_nav_security_description(),
    icon: "shield",
    match: (p) => p.startsWith("/app/admin/security"),
  },
  {
    href: "/app/admin/newsletter",
    label: m.common_newsletter(),
    description: m.admin_nav_newsletter_description(),
    icon: "sparkles",
    match: (p) => p.startsWith("/app/admin/newsletter"),
  },
  {
    href: "/app/admin/reports",
    label: m.admin_social_reports_title(),
    description: m.admin_nav_reports_description(),
    icon: "flag",
    match: (p) => p.startsWith("/app/admin/reports"),
  },
];
