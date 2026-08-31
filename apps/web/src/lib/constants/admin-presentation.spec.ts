import { m } from "$lib/paraglide/messages.js";
import { getLocale, overwriteGetLocale } from "$lib/paraglide/runtime.js";
import type { ServiceArea, ServiceStatusDto } from "@loomkeep/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  adminJobLabel,
  adminJobSchedule,
  adminServiceDetail,
  adminServiceLabel,
  adminTemplateFieldLabel,
  adminTemplateLabel,
  groupAdminServices,
} from "./admin-presentation";

const previousLocale = getLocale;
afterEach(() => overwriteGetLocale(previousLocale));
const service = (area: ServiceArea): ServiceStatusDto => ({
  key: "omdb",
  area,
  label: "OMDb (notes)",
  required: false,
  configured: true,
  reachable: true,
});

describe("admin presentation", () => {
  it.each(["fr", "en"] as const)(
    "keeps all API services visible in %s",
    (locale) => {
      overwriteGetLocale(() => locale);
      const services = (
        [
          "Vidéo",
          "Jeux",
          "Livres",
          "Musique",
          "Podcasts",
          "Jeux de société",
          "Système",
        ] as const
      ).map(service);
      const groups = groupAdminServices(services);
      expect(groups.flatMap((group) => group.items)).toEqual(services);
      expect(groups.map((group) => group.label)).toEqual([
        m.common_Media(),
        m.common_Games(),
        m.common_Books(),
        m.common_Music(),
        m.common_Podcasts(),
        m.common_Boardgames(),
        m.common_system(),
      ]);
      expect(adminServiceLabel("omdb", "OMDb (notes)")).toBe(
        locale === "fr" ? "OMDb (notes)" : "OMDb (ratings)",
      );
      expect(adminServiceLabel("", "OMDb (notes)")).toBe(
        m.admin_service_omdb(),
      );
      expect(adminServiceLabel("tmdb", "TMDB")).toBe("TMDB");
      expect(adminServiceDetail({ ...services[0], configured: false })).toBe(
        m.admin_service_missing_key(),
      );
      expect(adminServiceDetail({ ...services[0], reachable: false })).toBe(
        m.admin_service_unreachable(),
      );
      expect(
        adminServiceDetail({
          ...services[0],
          comingSoon: true,
          configured: false,
        }),
      ).toBeNull();
      expect(adminServiceDetail(services[0])).toBeNull();
    },
  );

  it.each(["fr", "en"] as const)(
    "localizes every registered job and admin gallery control in %s",
    (locale) => {
      overwriteGetLocale(() => locale);

      for (const key of [
        "notifications.scan",
        "notifications.digest",
        "media.refreshStale",
        "reports.digest",
        "backup.run",
        "users.inactiveAccountsScan",
      ]) {
        expect(adminJobLabel(key)).not.toBe(key);
        expect(adminJobSchedule(key)).not.toBeNull();
      }

      expect(adminJobSchedule("media.refreshStale")).toBe(
        locale === "fr" ? "Toutes les 6 heures" : "Every 6 hours",
      );
      expect(adminJobSchedule("backup.run")).toBe(
        m.admin_job_daily_at({ time: "03:00" }),
      );

      for (const key of [
        "welcome",
        "verifyEmail",
        "passwordResetLink",
        "passwordChanged",
        "emailChangedOld",
        "emailChangedNew",
        "emailChangeCode",
        "mfaEmailCode",
        "newsletter",
        "episodeDigest",
        "reportsDigest",
        "newDeviceLogin",
        "inactivityWarning",
        "moderationDecision",
      ]) {
        expect(adminTemplateLabel(key)).not.toBe(key);
      }

      for (const key of [
        "displayName",
        "token",
        "newEmail",
        "oldEmail",
        "code",
        "title",
        "content",
        "itemCount",
        "period",
        "pendingCount",
        "deviceLabel",
        "ip",
        "deletionDate",
        "measure",
        "legalBasis",
        "reasonText",
        "tosClause",
      ]) {
        expect(adminTemplateFieldLabel(key)).not.toBe(key);
      }

      expect(adminTemplateFieldLabel("deviceLabel")).toBe(
        locale === "fr" ? "Appareil" : "Device",
      );
      expect(adminJobLabel("future.job")).toBe("future.job");
      expect(adminJobSchedule("future.job")).toBeNull();
      expect(adminTemplateLabel("futureTemplate")).toBe("futureTemplate");
    },
  );
});
