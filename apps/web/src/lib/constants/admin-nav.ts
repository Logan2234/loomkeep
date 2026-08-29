import type Icon from "$lib/components/Icon.svelte";
import { m } from "$lib/paraglide/messages";
import type { ComponentProps } from "svelte";

/** One admin destination, shared by the admin rail and the /admin home cards. */
type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: ComponentProps<typeof Icon>["name"];
  match: (path: string) => boolean;
  /** Only shown when `appConfig.erdEnabled` (dev-only content, see config.svelte.ts). */
  devOnly?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/app/admin/services",
    label: "Services",
    description:
      "Santé et usage des dépendances externes (clés, disponibilité, quotas).",
    icon: "monitor",
    match: (p) => p.startsWith("/app/admin/services"),
  },
  {
    href: "/app/admin/users",
    label: "Utilisateurs",
    description: "Comptes enregistrés et sessions actives.",
    icon: "user",
    match: (p) => p.startsWith("/app/admin/users"),
  },
  {
    href: "/app/admin/communications",
    label: "Communications",
    description:
      "Gabarits email (aperçu/test) et notifications push (test/diffusion).",
    icon: "mail",
    match: (p) => p.startsWith("/app/admin/communications"),
  },
  {
    href: "/app/admin/stats",
    label: m.common_stats(),
    description: "Usage global et tailles des bibliothèques.",
    icon: "stats",
    match: (p) => p.startsWith("/app/admin/stats"),
  },
  {
    href: "/app/admin/jobs",
    label: "Jobs & tâches",
    description: "Visibilité des scans/refresh planifiés (cron).",
    icon: "calendar",
    match: (p) => p.startsWith("/app/admin/jobs"),
  },
  {
    href: "/app/admin/backup",
    label: "Sauvegarde",
    description: "Export/restauration complète de la base de données.",
    icon: "archive",
    match: (p) => p.startsWith("/app/admin/backup"),
  },
  {
    href: "/app/admin/imports",
    label: "Imports",
    description: "Journal des imports (Steam, StoryGraph, TV Time…).",
    icon: "download",
    match: (p) => p.startsWith("/app/admin/imports"),
  },
  {
    href: "/app/admin/cache",
    label: "Cache & synchronisation",
    description: "Explorateur du cache DB, re-sync manuel par item.",
    icon: "database",
    match: (p) => p.startsWith("/app/admin/cache"),
  },
  {
    href: "/app/admin/schema",
    label: "Schéma",
    description: "Graphe du schéma DB et des modules de l'app.",
    icon: "library",
    match: (p) => p.startsWith("/app/admin/schema"),
    devOnly: true,
  },
  {
    href: "/app/admin/security",
    label: m.common_security(),
    description:
      "Journal des actions sensibles (création/suppression de compte, identifiants, connexions échouées).",
    icon: "shield",
    match: (p) => p.startsWith("/app/admin/security"),
  },
  {
    href: "/app/admin/newsletter",
    label: "Newsletter",
    description:
      "Historique des envois — déclenchés automatiquement à la publication d'une note de version sur Quackback.",
    icon: "sparkles",
    match: (p) => p.startsWith("/app/admin/newsletter"),
  },
  {
    href: "/app/admin/reports",
    label: "Signalements",
    description: "File de modération des commentaires signalés.",
    icon: "flag",
    match: (p) => p.startsWith("/app/admin/reports"),
  },
];
