<script lang="ts">
  // "Poste de contrôle": a status strip of the 4 numbers an admin actually
  // checks at a glance (each a real link to its page), then every ADMIN_NAV
  // destination grouped by concern instead of one flat grid of identical
  // cards — see apps/web/DESIGN.md for the palette/type tokens this reuses.
  import { adminReports } from "$lib/admin-reports.svelte";
  import {
    getAdminBackupFiles,
    getAdminJobs,
    getAdminOverview,
    getAdminServices,
    getAdminVersion,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { ADMIN_NAV } from "$lib/constants/admin-nav";
  import { CHANGELOG_URL } from "$lib/constants/external-links";
  import { m } from "$lib/paraglide/messages";
  import type {
    AdminBackupFileDto,
    AdminOverviewDto,
    JobDto,
    ServiceStatusDto,
  } from "@loomkeep/shared";

  let version = $state<string | null>(null);
  let overview = $state<AdminOverviewDto | null>(null);
  let services = $state<ServiceStatusDto[] | null>(null);
  let jobs = $state<JobDto[] | null>(null);
  let backups = $state<AdminBackupFileDto[] | null>(null);

  $effect(() => {
    getAdminVersion()
      .then((v) => (version = v.version))
      .catch(() => {});
    void adminReports.refresh();
    getAdminOverview()
      .then((o) => (overview = o))
      .catch(() => {});
    getAdminServices()
      .then((r) => (services = r.services))
      .catch(() => {});
    getAdminJobs()
      .then((r) => (jobs = r.jobs))
      .catch(() => {});
    getAdminBackupFiles()
      .then((f) => (backups = f))
      .catch(() => {});
  });

  // ---- derived numbers for the strip + row metrics, all best-effort (a
  // failed fetch just leaves that card/metric blank rather than breaking
  // the page) ----

  const usersTotal = $derived(overview?.accounts ?? null);
  const usersDeltaWeek = $derived(overview?.newAccountsThisWeek ?? null);

  /** A service counts as degraded once it's live/required and either unconfigured or unreachable. */
  function isDegraded(s: ServiceStatusDto): boolean {
    if (s.comingSoon) return false;
    if (!s.configured) return s.required;
    return s.reachable === false;
  }
  const servicesLive = $derived(services?.filter((s) => !s.comingSoon) ?? []);
  const servicesDegraded = $derived(servicesLive.filter(isDegraded).length);

  const jobsFailedRecent = $derived(
    jobs?.filter((j) => j.runs[0]?.status === "FAILURE").length ?? null,
  );
  const jobsLastRunAt = $derived.by(() => {
    if (!jobs) return null;
    const starts = jobs
      .map((j) => j.runs[0]?.startedAt)
      .filter((d): d is string => !!d);
    return starts.length > 0 ? starts.reduce((a, b) => (a > b ? a : b)) : null;
  });

  const cacheTotal = $derived(overview?.cachedItems ?? null);

  const relTime = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  function relative(iso: string): string {
    const diffMs = new Date(iso).getTime() - Date.now();
    const hours = Math.round(diffMs / 3_600_000);
    if (Math.abs(hours) < 1) return "à l'instant";
    if (Math.abs(hours) < 24) return relTime.format(hours, "hour");
    return relTime.format(Math.round(hours / 24), "day");
  }

  const nf = new Intl.NumberFormat("fr-FR");

  /** Per-row metric, only shown when a cheap real number backs it — no invented data. */
  const metricByHref = $derived.by((): Record<string, string | undefined> => {
    return {
      "/app/admin/users":
        usersTotal !== null ? nf.format(usersTotal) : undefined,
      "/app/admin/communications":
        overview !== null
          ? `${nf.format(overview.accountsWithPush)} abonné${overview.accountsWithPush > 1 ? "s" : ""} push`
          : undefined,
      "/app/admin/services": services
        ? `${servicesLive.length - servicesDegraded}/${servicesLive.length}`
        : undefined,
      "/app/admin/jobs": jobsLastRunAt ? relative(jobsLastRunAt) : undefined,
      "/app/admin/backup":
        backups && backups.length > 0
          ? `${backups.length} · dernière ${relative(backups[0].createdAt)}`
          : backups
            ? "aucune"
            : undefined,
      "/app/admin/cache":
        cacheTotal !== null ? `${nf.format(cacheTotal)} items` : undefined,
      "/app/admin/reports":
        adminReports.pending > 0
          ? `${adminReports.pending} en attente`
          : "à jour",
    };
  });

  const CATEGORIES: { label: string; hrefs: string[] }[] = [
    {
      label: "Contenu & données",
      hrefs: [
        "/app/admin/cache",
        "/app/admin/schema",
        "/app/admin/backup",
        "/app/admin/imports",
      ],
    },
    {
      label: "Utilisateurs & communication",
      hrefs: [
        "/app/admin/users",
        "/app/admin/communications",
        "/app/admin/newsletter",
      ],
    },
    {
      label: "Système & exploitation",
      hrefs: ["/app/admin/services", "/app/admin/jobs", "/app/admin/stats"],
    },
    {
      label: "Sécurité & modération",
      hrefs: ["/app/admin/security", "/app/admin/reports"],
    },
  ];

  const grouped = $derived(
    CATEGORIES.map((cat) => ({
      label: cat.label,
      items: cat.hrefs
        .map((href) => ADMIN_NAV.find((i) => i.href === href))
        .filter((i) => i !== undefined)
        .filter((i) => !i.devOnly || appConfig.erdEnabled),
    })),
  );
</script>

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="shield"
    title="Poste de contrôle"
    subtitle={`Connecté en tant que ${auth.user?.displayName}. Vue d'ensemble avant d'entrer dans une section.`} />

  <!-- The 4 numbers worth a glance before diving in — each links straight to its page. -->
  <div
    class="border-border bg-border mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4">
    <a
      href="/app/admin/users"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span class="bg-success h-1.5 w-1.5 rounded-full"></span>
        Utilisateurs
      </span>
      <span class="font-display text-2xl font-extrabold">
        {usersTotal !== null ? nf.format(usersTotal) : "—"}
      </span>
      <span class="text-dim text-xs">
        {usersDeltaWeek !== null
          ? `+${nf.format(usersDeltaWeek)} cette semaine`
          : " "}
      </span>
    </a>

    <a
      href="/app/admin/services"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {servicesDegraded > 0
            ? 'bg-danger'
            : 'bg-success'}"></span>
        Services
      </span>
      <span class="font-display text-2xl font-extrabold">
        {services
          ? `${servicesLive.length - servicesDegraded}/${servicesLive.length}`
          : "—"}
      </span>
      <span
        class="text-xs {servicesDegraded > 0
          ? 'text-danger font-semibold'
          : 'text-dim'}">
        {services
          ? servicesDegraded > 0
            ? `${servicesDegraded} dégradé${servicesDegraded > 1 ? "s" : ""}`
            : "tous opérationnels"
          : " "}
      </span>
    </a>

    <a
      href="/app/admin/jobs"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {jobsFailedRecent
            ? 'bg-danger'
            : 'bg-success'}"></span>
        Jobs
      </span>
      <span class="font-display text-2xl font-extrabold">
        {jobsFailedRecent !== null
          ? `${jobsFailedRecent} échec${jobsFailedRecent > 1 ? "s" : ""}`
          : "—"}
      </span>
      <span
        class="text-xs {jobsFailedRecent
          ? 'text-danger font-semibold'
          : 'text-dim'}">
        {jobsLastRunAt ? `dernier run ${relative(jobsLastRunAt)}` : " "}
      </span>
    </a>

    <a
      href="/app/admin/reports"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {adminReports.pending > 0
            ? 'bg-danger'
            : 'bg-success'}"></span>
        Signalements
      </span>
      <span class="font-display text-2xl font-extrabold">
        {nf.format(adminReports.pending)}
      </span>
      <span
        class="text-xs {adminReports.pending > 0
          ? 'text-danger font-semibold'
          : 'text-dim'}">
        {adminReports.pending > 0 ? "en attente de modération" : "à jour"}
      </span>
    </a>
  </div>

  <div class="space-y-8">
    {#each grouped as cat (cat.label)}
      <section>
        <h2
          class="text-dim mb-2 flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
          {cat.label}
          <span class="bg-border h-px flex-1"></span>
        </h2>
        <div class="border-border overflow-hidden rounded-xl border">
          {#each cat.items as item, i (item.href)}
            <a
              href={item.href}
              class="bg-surface hover:bg-surface-2 flex items-center gap-3 px-4 py-3 transition-colors {i >
              0
                ? 'border-border border-t'
                : ''}">
              <span
                class="bg-accent/10 text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg">
                <Icon name={item.icon} class="h-4.5 w-4.5" />
              </span>
              <div class="min-w-0 flex-1">
                <span class="text-fg flex items-center gap-2 font-semibold">
                  {item.label}
                  {#if item.href === "/app/admin/reports" && adminReports.pending > 0}
                    <span
                      class="bg-accent text-accent-fg rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold">
                      {adminReports.pending}
                    </span>
                  {:else if item.href === "/app/admin/services" && servicesDegraded > 0}
                    <span
                      class="border-danger/40 bg-danger/10 text-danger rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                      {servicesDegraded} dégradé{servicesDegraded > 1
                        ? "s"
                        : ""}
                    </span>
                  {/if}
                </span>
                <p class="text-dim mt-0.5 text-sm">{item.description}</p>
              </div>
              {#if metricByHref[item.href]}
                <span class="timecode shrink-0 text-xs whitespace-nowrap">
                  {metricByHref[item.href]}
                </span>
              {/if}
              <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
            </a>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  {#if version}
    <p class="text-dim mt-8 text-center text-xs">
      <a
        href={CHANGELOG_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="btn-text font-normal">
        {m.common_version({ version })}
      </a>
    </p>
  {/if}
</div>
