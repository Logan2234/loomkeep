export type AdminPageLayout = "reading" | "operations" | "data";

const READING_ROUTES = ["/app/admin/backup", "/app/admin/newsletter"];
const DATA_ROUTES = [
  "/app/admin/communications",
  "/app/admin/components",
  "/app/admin/schema",
  "/app/admin/stats",
];

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function adminPageLayout(pathname: string): AdminPageLayout {
  if (READING_ROUTES.some((route) => matchesRoute(pathname, route))) {
    return "reading";
  }

  if (DATA_ROUTES.some((route) => matchesRoute(pathname, route))) return "data";
  return "operations";
}

export const ADMIN_PAGE_WIDTH = {
  reading: "max-w-3xl",
  operations: "max-w-5xl",
  data: "max-w-7xl",
} satisfies Record<AdminPageLayout, string>;
