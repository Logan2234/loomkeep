import type { ComponentProps } from "svelte";
import type Icon from "$lib/components/Icon.svelte";

type IconName = ComponentProps<typeof Icon>["name"];

/** One admin destination, shared by the admin rail and the /admin home cards. */
export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  match: (path: string) => boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin/services",
    label: "Services",
    description:
      "Santé et usage des dépendances externes (clés, disponibilité, quotas).",
    icon: "monitor",
    match: (p) => p.startsWith("/admin/services"),
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    description: "Comptes enregistrés et sessions actives.",
    icon: "user",
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    href: "/admin/communications",
    label: "Communications",
    description:
      "Gabarits email (aperçu/test) et notifications push (test/diffusion).",
    icon: "mail",
    match: (p) => p.startsWith("/admin/communications"),
  },
  {
    href: "/admin/stats",
    label: "Statistiques",
    description: "Usage global et tailles des bibliothèques.",
    icon: "stats",
    match: (p) => p.startsWith("/admin/stats"),
  },
  {
    href: "/admin/jobs",
    label: "Jobs & tâches",
    description: "Visibilité des scans/refresh planifiés (cron).",
    icon: "calendar",
    match: (p) => p.startsWith("/admin/jobs"),
  },
  {
    href: "/admin/backup",
    label: "Sauvegarde",
    description: "Export/restauration complète de la base de données.",
    icon: "archive",
    match: (p) => p.startsWith("/admin/backup"),
  },
  {
    href: "/admin/imports",
    label: "Imports",
    description: "Journal des imports (Steam, StoryGraph, TV Time…).",
    icon: "download",
    match: (p) => p.startsWith("/admin/imports"),
  },
  {
    href: "/admin/cache",
    label: "Cache & synchronisation",
    description: "Explorateur du cache DB, re-sync manuel par item.",
    icon: "database",
    match: (p) => p.startsWith("/admin/cache"),
  },
  {
    href: "/admin/schema",
    label: "Schéma",
    description: "Graphe du schéma DB et des modules de l'app.",
    icon: "library",
    match: (p) => p.startsWith("/admin/schema"),
  },
  {
    href: "/admin/security",
    label: "Sécurité",
    description:
      "Journal des actions sensibles (création/suppression de compte, identifiants, connexions échouées).",
    icon: "shield",
    match: (p) => p.startsWith("/admin/security"),
  },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    description:
      "Historique des envois — déclenchés automatiquement à la publication d'une note de version sur Quackback.",
    icon: "sparkles",
    match: (p) => p.startsWith("/admin/newsletter"),
  },
  {
    href: "/admin/reports",
    label: "Signalements",
    description: "File de modération des commentaires signalés.",
    icon: "flag",
    match: (p) => p.startsWith("/admin/reports"),
  },
];
