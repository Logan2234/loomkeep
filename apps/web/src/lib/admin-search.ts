import { VISIBLE_ADMIN_NAV_GROUPS } from "$lib/constants/admin-nav";

export function foldAdminSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const keywords: Record<string, string> = {
  users: "invitations invitation email account compte MFA newsletter",
  communications: "email SMTP push notifications modèles templates",
  services: "quotas fournisseurs providers SMTP configuration",
  settings: "registration inscriptions social gamification API quotas",
  backup: "restauration restore sauvegarde SQL",
  cache: "catalogue catalog synchronisation orphelins",
  security: "connexion login authentification MFA sessions clés API",
};

export function searchAdminSections(query: string) {
  const terms = foldAdminSearch(query).trim().split(/\s+/).filter(Boolean);
  return VISIBLE_ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const text = foldAdminSearch(
        `${group.label} ${item.label} ${item.description} ${keywords[item.href.split("/").at(-1)!] ?? ""}`,
      );
      return terms.every((term) => text.includes(term));
    }),
  })).filter((group) => group.items.length > 0);
}
