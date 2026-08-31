import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("remaining frontend translation regressions", () => {
  it("renders notification wording through a localized presenter", () => {
    const text = source("./lib/components/NotificationBell.svelte");
    expect(text.includes("{n.title}")).toBe(false);
    expect(text.includes("{n.body}")).toBe(false);
  });

  it("does not use translated service labels to filter API categories", () => {
    const text = source("./routes/app/admin/services/+page.svelte");
    expect(text.includes("Object.values(DOMAINS).map((d) => d.label)")).toBe(
      false,
    );
    expect(text.includes("{s.detail}")).toBe(false);
  });

  it("localizes job and admin form labels instead of rendering API prose", () => {
    const jobs = source("./routes/app/admin/jobs/+page.svelte");
    expect(jobs.includes("{job.label}")).toBe(false);
    expect(jobs.includes("{job.schedule}")).toBe(false);
    const forms = source("./routes/app/admin/communications/+page.svelte");
    expect(forms.includes("{t.label}")).toBe(false);
    expect(forms.includes("{f.label}")).toBe(false);
  });

  it("uses the active language as the display fallback in both selectors", () => {
    for (const path of [
      "./lib/components/onboarding/OnboardingWizard.svelte",
      "./routes/app/settings/components/AppearanceSection.svelte",
    ]) {
      const text = source(path);
      expect(text.includes('auth.user?.locale ?? "fr"')).toBe(false);
      expect(text.includes("auth.user?.locale ?? getLocale()")).toBe(true);
    }
  });

  it("localizes backup day units and admin duration decimals", () => {
    expect(
      source("./routes/app/admin/backup/+page.svelte").includes(
        'undefined : "j"',
      ),
    ).toBe(false);

    for (const page of ["jobs", "imports", "backup"]) {
      expect(
        source(`./routes/app/admin/${page}/+page.svelte`).includes(
          ".toFixed(1)",
        ),
      ).toBe(false);
    }
  });
});
