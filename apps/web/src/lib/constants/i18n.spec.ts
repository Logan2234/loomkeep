import { beforeEach, describe, expect, it, vi } from "vitest";

describe("translated constants", () => {
  beforeEach(() => vi.resetModules());

  it.each(["fr", "en"] as const)(
    "uses %s without changing technical values",
    async (locale) => {
      const { overwriteGetLocale } = await import("../paraglide/runtime.js");
      overwriteGetLocale(() => locale);
      const { ADMIN_NAV } = await import("./admin-nav");
      const { BOOK_STATUS_LABELS, BOOK_STATUS_META, GAME_STATUS_LABELS } =
        await import("./status-labels");
      const { IMPORTS_DEFINITION } = await import("./import-sources");
      const { GAME_OWNERSHIP_STATUS_OPTIONS, BOOK_OWNERSHIP_SOURCES } =
        await import("./ownership-sources");
      const { REPORT_CATEGORY_LABELS, defaultModerationBasis } =
        await import("./report-labels");
      const { NAV_STYLE_META } = await import("../navStyle.svelte");

      expect(
        ADMIN_NAV.find((item) => item.href === "/app/admin/users")?.label,
      ).toBe(locale === "en" ? "Users" : "Utilisateurs");
      expect(BOOK_STATUS_LABELS.TO_READ).toBe(
        locale === "en" ? "To read" : "À lire",
      );
      expect(BOOK_STATUS_META.TO_READ.label).toBe(BOOK_STATUS_LABELS.TO_READ);
      expect(GAME_STATUS_LABELS.COMPLETED).toBe(
        locale === "en" ? "Completed" : "Terminé",
      );
      expect(IMPORTS_DEFINITION.tvtime.description).toBe(
        locale === "en"
          ? "Movies, series and anime."
          : "Films, séries et anime.",
      );
      expect(IMPORTS_DEFINITION.tvtime.input.type).toBe("zip");
      expect(IMPORTS_DEFINITION.steam.label).toBe("Steam");
      expect(
        GAME_OWNERSHIP_STATUS_OPTIONS.find(
          (option) => option.value === "PHYSICAL",
        )?.label,
      ).toBe(locale === "en" ? "Physical" : "Physique");
      expect(BOOK_OWNERSHIP_SOURCES.DIGITAL).toContain("Google Play Livres");
      expect(REPORT_CATEGORY_LABELS.HARASSMENT).toBe(
        locale === "en" ? "Harassment" : "Harcèlement",
      );
      expect(defaultModerationBasis("SPAM")).toEqual({
        legalBasis: "TOS_BREACH",
        tosClause:
          locale === "en" ? "§7 — Rules of conduct" : "§7 — Règles de conduite",
      });
      expect(defaultModerationBasis("ILLEGAL_CONTENT")).toEqual({
        legalBasis: "ILLEGAL_CONTENT",
        tosClause: "",
      });
      expect(NAV_STYLE_META.board.label).toBe(
        locale === "en" ? "Program" : "Programme",
      );
      expect(NAV_STYLE_META.board.premium).toBe(true);
    },
    30000,
  );
});
