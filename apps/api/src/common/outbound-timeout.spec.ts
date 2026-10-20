import { vi } from "vitest";
import { TurnstileService } from "../auth/turnstile.service";
import { OmdbService } from "../catalog/omdb.service";
import { SimklImportSource } from "../import/sources/simkl/simkl.source";
import { SteamImportSource } from "../import/sources/steam/steam.source";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MusicBrainzProvider } from "../music/providers/musicbrainz.provider";
import { NewsletterService } from "../newsletter/newsletter.service";
import { RequestThrottle } from "./request-throttle";

const config = {
  get: vi.fn(() => "configured"),
  getOrThrow: vi.fn(() => "configured"),
};
const quota = { record: vi.fn() };
const progress = { setTotal: vi.fn(), tick: vi.fn() };

describe("outbound request deadlines", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    "Turnstile",
    "OMDb",
    "Simkl OAuth",
    "Simkl export",
    "Steam",
    "Healthchecks",
    "Quackback",
    "Cover Art Archive",
  ])(
    "finishes a hung %s request within the shared deadline",
    async (source) => {
      const controller = new AbortController();
      const deadline = vi
        .spyOn(AbortSignal, "timeout")
        .mockReturnValue(controller.signal);
      vi.spyOn(RequestThrottle.prototype, "wait").mockResolvedValue(undefined);
      const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        if (source === "Simkl export" && String(url).endsWith("/oauth/token")) {
          return Promise.resolve(Response.json({ access_token: "token" }));
        }

        if (
          source === "Cover Art Archive" &&
          new URL(String(url)).hostname === "musicbrainz.org"
        ) {
          return Promise.resolve(
            Response.json({ id: "album", title: "Album", releases: [] }),
          );
        }

        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const newsletterUpdate = vi.fn().mockResolvedValue(undefined);
      let request: Promise<unknown>;

      switch (source.startsWith("Simkl") ? "Simkl" : source) {
        case "Turnstile":
          request = new TurnstileService(config as never).verify("token");
          break;
        case "OMDb":
          request = new OmdbService(config as never, quota as never).getRatings(
            "tt123",
          );
          break;

        case "Simkl": {
          const service = new SimklImportSource(
            null!,
            null!,
            null!,
            null!,
            config as never,
            quota as never,
          );
          request = service.buildPlan(
            "viewer",
            service.parseInput("code"),
            progress,
          );
          break;
        }

        case "Steam": {
          const service = new SteamImportSource(
            config as never,
            null!,
            null!,
            null!,
            null!,
            quota as never,
          );
          request = service.buildPlan(
            "viewer",
            service.parseInput("76561198000000000"),
            progress,
          );
          break;
        }

        case "Healthchecks": {
          vi.stubEnv("HEALTHCHECKS_BACKUP_URL", "https://hc-ping.com/test");
          const prisma = {
            jobRun: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn(),
              findMany: vi.fn().mockResolvedValue([]),
            },
          };
          request = new JobRunService(prisma as never, null!, null!).record(
            JOB_KEYS.BACKUP,
            async () => "ok",
            () => "summary",
          );
          break;
        }

        case "Quackback": {
          vi.stubEnv("QUACKBACK_API_KEY", "test-key");
          const prisma = {
            newsletterSend: {
              create: vi.fn().mockResolvedValue({ id: "send" }),
              update: newsletterUpdate,
            },
            user: { findMany: vi.fn().mockResolvedValue([]) },
          };
          request = new NewsletterService(
            prisma as never,
            null!,
          ).handleChangelogPublished("entry", "Title", "Preview", "");
          break;
        }

        default:
          request = new MusicBrainzProvider(
            config as never,
            quota as never,
          ).getDetails("album");
          break;
      }

      const result = request.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

      if (source === "Simkl export") {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      }

      const findBlockedCall = () =>
        fetchMock.mock.calls.find(([url]) =>
          source === "Cover Art Archive"
            ? new URL(String(url)).hostname === "coverartarchive.org"
            : source === "Simkl export"
              ? !String(url).endsWith("/oauth/token")
              : true,
        );
      await vi.waitFor(() => expect(findBlockedCall()).toBeDefined());
      const blockedCall = findBlockedCall();
      expect(blockedCall?.[1]?.signal).toBe(controller.signal);
      expect(deadline).toHaveBeenCalledWith(10_000);
      controller.abort(new DOMException("Request timed out", "TimeoutError"));
      const outcome = await result;

      if (source.startsWith("Simkl") || source === "Steam") {
        expect(outcome).toHaveProperty("error.name", "TimeoutError");
      } else if (source === "Turnstile") {
        expect(outcome).toEqual({ value: false });
      } else if (source === "OMDb") {
        expect(outcome).toEqual({ value: [] });
      } else if (source === "Healthchecks") {
        expect(outcome).toEqual({ value: "ok" });
      } else if (source === "Cover Art Archive") {
        expect(outcome).toHaveProperty("value.extraCoverImages", []);
      } else {
        await vi.waitFor(() => expect(newsletterUpdate).toHaveBeenCalled());
      }
    },
  );
});
