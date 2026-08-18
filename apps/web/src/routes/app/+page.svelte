<script lang="ts">
  import {
    getCalendar,
    listBooks,
    listGames,
    listLibrary,
    listMusic,
    updateLibraryEntry,
    watchEpisode,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import BetaBadge from "$lib/components/BetaBadge.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import HomeActivityPreview from "$lib/components/HomeActivityPreview.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import ReadingGoalDashboardCard from "$lib/components/ReadingGoalDashboardCard.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { IS_BETA } from "$lib/constants/app-status";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages";
  import type {
    BookEntryDto,
    CalendarEntryDto,
    GameEntryDto,
    LibraryEntryDto,
    MusicEntryDto,
    NextEpisodeDto,
  } from "@loomkeep/shared";
  import { Domain } from "@loomkeep/shared";
  import { tick } from "svelte";

  const mediaOn = $derived(isDomainEnabled(Domain.MEDIA));
  const gamesOn = $derived(isDomainEnabled(Domain.GAMES));
  const booksOn = $derived(isDomainEnabled(Domain.BOOKS));
  const musicOn = $derived(isDomainEnabled(Domain.MUSIC));
  // Podcasts/Jeux de société have no screens yet — surfaced as a dimmed
  // "Bientôt" teaser here for consistency with the nav rail/menu sheet, but
  // only once the user has actually opted into one of the two (they're
  // off by default, unlike the other 4 domains).
  const soonOn = $derived(
    isDomainEnabled(Domain.PODCASTS) || isDomainEnabled(Domain.BOARDGAMES),
  );

  let watching = $state<LibraryEntryDto[]>([]);
  let plannedMovies = $state<LibraryEntryDto[]>([]);
  let upcoming = $state<CalendarEntryDto[]>([]);
  let playingGames = $state<GameEntryDto[]>([]);
  let readingBooks = $state<BookEntryDto[]>([]);
  let toListenAlbums = $state<MusicEntryDto[]>([]);
  let loading = $state(true);
  let resuming = $state<string | null>(null); // entry id being resumed
  let markingMovieSeen = $state<string | null>(null);
  let resumeCarousel = $state<{ scrollToStart: () => void }>();

  // Fetch only the enabled domains' "in progress" content — the dashboard is
  // best-effort, so a failing call just leaves its section empty. Reads the
  // domain flags synchronously so the effect reloads when one is toggled.
  async function load() {
    if (!auth.user) return;
    loading = true;
    const jobs: Promise<unknown>[] = [];

    if (mediaOn) {
      jobs.push(
        listLibrary({
          statuses: ["WATCHING"],
          types: ["SERIES", "ANIME"],
        }).then((r) => (watching = r.items)),
      );
      jobs.push(
        listLibrary({ statuses: ["PLANNED"], types: ["MOVIE"] }).then(
          (r) => (plannedMovies = r.items),
        ),
      );
      jobs.push(getCalendar().then((c) => (upcoming = c)));
    } else {
      watching = [];
      plannedMovies = [];
      upcoming = [];
    }
    if (gamesOn)
      jobs.push(
        listGames({ statuses: ["PLAYING"] }).then(
          (r) => (playingGames = r.items),
        ),
      );
    else playingGames = [];
    if (booksOn)
      jobs.push(
        listBooks({ statuses: ["READING"] }).then(
          (r) => (readingBooks = r.items),
        ),
      );
    else readingBooks = [];
    if (musicOn)
      jobs.push(
        listMusic({ statuses: ["TO_LISTEN"] }).then(
          (r) => (toListenAlbums = r.items),
        ),
      );
    else toListenAlbums = [];

    try {
      await Promise.all(jobs);
    } catch {
      // Dashboard is best-effort; leave sections empty on error.
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const epCodeOf = (n: NextEpisodeDto) =>
    `S${String(n.seasonNumber).padStart(2, "0")}E${String(n.episodeNumber).padStart(2, "0")}`;

  /**
   * One-click resume: mark the entry's next unwatched episode as watched.
   * Re-fetches just the watching list (not the whole dashboard, so no
   * `loading` skeleton flash) and swaps it in — the entry now sorts first
   * in `watchingRecent`, so the carousel is scrolled back to its start to
   * keep it in view.
   */
  async function resume(entry: LibraryEntryDto) {
    const next = entry.progress?.nextEpisode;
    if (!next) return;
    resuming = entry.id;
    try {
      await watchEpisode(next.episodeId);
      watching = (
        await listLibrary({
          statuses: ["WATCHING"],
          types: ["SERIES", "ANIME"],
        })
      ).items;
      await tick();
      resumeCarousel?.scrollToStart();
    } catch {
      // ignore; the card stays as-is
    } finally {
      resuming = null;
    }
  }

  async function markMovieSeen(entry: LibraryEntryDto) {
    markingMovieSeen = entry.id;
    try {
      await updateLibraryEntry(entry.id, { status: "COMPLETED" });
      plannedMovies = plannedMovies.filter((movie) => movie.id !== entry.id);
    } catch {
      // Ignore; the card stays as-is.
    } finally {
      markingMovieSeen = null;
    }
  }

  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  });

  function pct(e: LibraryEntryDto): number {
    if (!e.progress || e.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (e.progress.watchedEpisodes / e.progress.totalEpisodes) * 100,
    );
  }

  function bookPct(e: BookEntryDto): number | null {
    if (!e.book.pageCount) return null;
    return Math.round((e.currentPage / e.book.pageCount) * 100);
  }

  const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
  function dayShort(iso: string): string {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return "Auj.";
    if (diff === 1) return "Demain";
    return weekdayShort.format(new Date(iso));
  }
  const epCode = (e: CalendarEntryDto) =>
    `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`;
  const mediaHref = (e: CalendarEntryDto) =>
    `/app/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`;
  const week = $derived(upcoming.slice(0, 3));

  // Surface the most recently updated entries first; keep the card compact.
  const updatedTime = (entry: LibraryEntryDto) =>
    new Date(entry.lastWatchedAt || entry.updatedAt).getTime();
  const RESUME_LIMIT = 20;
  const watchingRecent = $derived(
    [...watching]
      .sort((a, b) => updatedTime(b) - updatedTime(a))
      .slice(0, RESUME_LIMIT),
  );
  const toWatch = $derived(
    [...watchingRecent, ...plannedMovies]
      .sort((a, b) => updatedTime(b) - updatedTime(a))
      .slice(0, RESUME_LIMIT),
  );
</script>

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="home"
    title={`${greeting}${auth.user ? ", " + auth.user.displayName : ""}.`}
    subtitle="Reprends là où tu t'es arrêté." />

  {#if loading}
    <div class="mb-10 flex flex-col gap-10">
      <div>
        <div class="skeleton mb-4 h-3 w-20 rounded"></div>
        <div class="skeleton mb-3 h-6 w-32 rounded"></div>
        <div class="flex gap-4 overflow-hidden">
          {#each { length: 4 } as _, j (j)}
            <div class="w-32 shrink-0 sm:w-36">
              <div class="skeleton aspect-2/3 w-full rounded-xl"></div>
              <div class="skeleton mt-2 h-3 w-4/5 rounded"></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- Two independent grids side by side on desktop, not one shared
         12-col grid sliced with col-span: a wide "main" grid (Vidéo, the
         3 domain carousels, Activité) and a narrow "sidebar" stack (Cette
         semaine, Objectif de lecture, Raccourcis) that never interleave
         with each other's rows. On mobile they just stack, main first. -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
      <!-- Main grid. -->
      <div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#if mediaOn}
          <section class="card sm:col-span-2 lg:col-span-3">
            <div class="flex items-center justify-between p-4 pb-0">
              <h2
                class="font-display flex items-center gap-2 text-base font-bold">
                <Icon name="tv" class="text-accent h-4 w-4" /> Vidéo · à voir
              </h2>
              <a href="/app/media" class="btn-text">Voir plus →</a>
            </div>
            <div class="p-4">
              {#if toWatch.length > 0}
                <Carousel
                  bind:this={resumeCarousel}
                  items={toWatch}
                  keyOf={(e) => e.id}>
                  {#snippet card(e)}
                    <div class="w-28 shrink-0 snap-start">
                      <a
                        href={`/app/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`}
                        class="block">
                        <div
                          class="card hover:border-accent overflow-hidden transition-[border-color]">
                          <Poster
                            src={e.mediaItem.posterUrl}
                            title={e.mediaItem.title} />
                        </div>
                        <p
                          class="font-display mt-1.5 truncate text-xs font-semibold">
                          {e.mediaItem.title}
                        </p>
                      </a>
                      {#if e.progress}
                        <div
                          class="bg-surface-2 mt-1 h-1 overflow-hidden rounded-full">
                          <div
                            class="bg-accent h-full"
                            style={`width: ${pct(e)}%`}
                            title="{e.progress.watchedEpisodes} / {e.progress
                              .totalEpisodes}">
                          </div>
                        </div>
                        {#if e.progress.nextEpisode}
                          <button
                            class="btn btn-primary btn-sm mt-2 w-full"
                            disabled={resuming === e.id}
                            onclick={() => resume(e)}>
                            ▶ {epCodeOf(e.progress.nextEpisode)}
                          </button>
                        {/if}
                      {:else if e.mediaItem.type === "MOVIE"}
                        <button
                          class="btn btn-primary btn-sm mt-4 w-full"
                          disabled={markingMovieSeen === e.id}
                          onclick={() => markMovieSeen(e)}>
                          Vu
                        </button>
                      {/if}
                    </div>
                  {/snippet}
                </Carousel>
              {:else}
                <p class="text-dim py-10 text-center text-sm">
                  Rien à voir pour le moment.
                </p>
              {/if}
            </div>
          </section>
        {/if}

        {#if gamesOn}
          <section class="card p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2
                class="font-display flex items-center gap-2 text-base font-bold">
                <Icon name="gamepad" class="text-accent h-4 w-4" /> Jeux · en cours
              </h2>
              <a href="/app/games" class="btn-text">Voir →</a>
            </div>
            {#if playingGames.length > 0}
              <Carousel items={playingGames} keyOf={(e) => e.id}>
                {#snippet card(e)}
                  <a
                    href={`/app/games/${e.game.sourceId}`}
                    class="w-24 shrink-0 snap-start">
                    <div
                      class="card hover:border-accent overflow-hidden transition-[border-color]">
                      <Poster src={e.game.coverUrl} title={e.game.title} />
                    </div>
                    <p
                      class="font-display mt-1.5 truncate text-xs font-semibold">
                      {e.game.title}
                    </p>
                    {#if e.playtimeMinutes > 0}
                      <p class="timecode text-[0.65rem]">
                        {Math.round(e.playtimeMinutes / 60)} h jouées
                      </p>
                    {/if}
                  </a>
                {/snippet}
              </Carousel>
            {:else}
              <p class="text-dim py-10 text-center text-sm">
                Rien en cours de partie.
              </p>
            {/if}
          </section>
        {/if}

        {#if booksOn}
          <section class="card p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2
                class="font-display flex items-center gap-2 text-base font-bold">
                <Icon name="book" class="text-accent h-4 w-4" /> Livres · en lecture
              </h2>
              <a href="/app/books" class="btn-text">Voir →</a>
            </div>
            {#if readingBooks.length > 0}
              <ul class="divide-border divide-y">
                {#each readingBooks as e (e.id)}
                  {@const p = bookPct(e)}
                  <li>
                    <a
                      href={`/app/books/${e.book.sourceId}`}
                      class="flex items-center gap-3 py-2">
                      <div class="w-8 shrink-0 overflow-hidden rounded-md">
                        <Poster src={e.book.coverUrl} title={e.book.title} />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="font-display truncate text-sm font-semibold">
                          {e.book.title}
                        </p>
                        {#if p !== null}
                          <div
                            class="bg-surface-2 mt-1 h-1 max-w-32 overflow-hidden rounded-full">
                            <div
                              class="bg-accent h-full"
                              style={`width: ${p}%`}>
                            </div>
                          </div>
                        {/if}
                        <p class="timecode text-xs">
                          {#if e.book.pageCount}
                            p. {e.currentPage} / {e.book.pageCount}
                          {:else}
                            p. {e.currentPage}
                          {/if}
                        </p>
                      </div>
                    </a>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-dim py-6 text-center text-sm">
                Rien en cours de lecture.
              </p>
            {/if}
          </section>
        {/if}

        {#if musicOn}
          <section class="card p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2
                class="font-display flex items-center gap-2 text-base font-bold">
                <Icon name="music" class="text-accent h-4 w-4" /> Musique · à écouter
              </h2>
              <a href="/app/music" class="btn-text">Voir →</a>
            </div>
            {#if toListenAlbums.length > 0}
              <Carousel items={toListenAlbums} keyOf={(e) => e.id}>
                {#snippet card(e)}
                  <a
                    href={`/app/music/${e.album.sourceId}`}
                    class="w-24 shrink-0 snap-start">
                    <div
                      class="card hover:border-accent overflow-hidden transition-[border-color]">
                      <Poster src={e.album.coverUrl} title={e.album.title} />
                    </div>
                    <p
                      class="font-display mt-1.5 truncate text-xs font-semibold">
                      {e.album.title}
                    </p>
                  </a>
                {/snippet}
              </Carousel>
            {:else}
              <p class="text-dim py-10 text-center text-sm">
                Rien à écouter pour l'instant.
              </p>
            {/if}
          </section>
        {/if}

        {#if soonOn}
          <section
            class="border-border flex flex-col justify-center gap-1 rounded-xl border border-dashed p-4 opacity-70">
            <p class="font-display text-sm font-bold">
              🎧 Podcasts &amp; 🎲 Jeux de société
            </p>
            <p class="text-dim text-xs">Bientôt disponible dans Loomkeep.</p>
            <span
              class="bg-surface-2 text-dim mt-1 w-fit rounded-full px-2 py-0.5 text-[0.6rem] font-bold">
              Bientôt
            </span>
          </section>
        {/if}

        <div class="sm:col-span-2 lg:col-span-3">
          <HomeActivityPreview limit={6} />
        </div>
      </div>

      <div class="sticky top-4 flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
        {#if mediaOn}
          <section class="card p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2
                class="font-display flex items-center gap-2 text-base font-bold">
                <Icon name="calendar" class="text-accent h-4 w-4" /> Cette semaine
              </h2>
              <a href="/app/calendar" class="btn-text">Calendrier →</a>
            </div>
            {#if week.length > 0}
              <ul class="divide-border divide-y">
                {#each week as e (e.mediaItem.id + epCode(e))}
                  <li>
                    <a href={mediaHref(e)} class="flex items-center gap-3 py-2">
                      <div class="w-8 shrink-0 overflow-hidden rounded-md">
                        <Poster
                          src={e.mediaItem.posterUrl}
                          title={e.mediaItem.title} />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="font-display truncate text-sm font-semibold">
                          {e.mediaItem.title}
                        </p>
                        <p class="timecode text-xs">
                          {epCode(e)}
                        </p>
                      </div>
                      <span
                        class="border-accent/40 text-accent timecode rounded-md border px-1.5 py-0.5 text-[0.65rem]">
                        {dayShort(e.airDate)}
                      </span>
                    </a>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-dim py-6 text-center text-sm">
                Rien de prévu cette semaine.
              </p>
            {/if}
          </section>
        {/if}

        {#if booksOn}
          <ReadingGoalDashboardCard />
        {/if}

        <section class="card p-2">
          <a
            href="/app/profile"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="user" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm font-semibold">Mon compte</span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
          <a
            href="/app/stats"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="stats" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm font-semibold">Statistiques</span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
          <a
            href="/app/lists"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="list" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm font-semibold">Mes listes</span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
          <a
            href="/app/reviews"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="star" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm font-semibold">Mes critiques</span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
          <a
            href="/app/feed"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="activity" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm font-semibold">Fil d'activité</span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
          <a
            href="/app/settings#aide"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="message" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex flex-1 items-center gap-2 text-sm font-semibold">
              Aide & Feedback
              {#if isFeatureNew("help-feedback")}<NewBadge />{/if}
            </span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
          <a
            href="/app/settings"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            <Icon name="gear" class="text-accent h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm font-semibold">Paramètres</span>
            <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
          </a>
        </section>

        <p class="text-dim mt-2 flex items-center justify-center gap-2 text-xs">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="btn-text font-normal">
            {m.common_version({ version: appConfig.version })}
            {#if appConfig.gitSha && appConfig.gitSha !== "unknown"}
              <span class="opacity-60">({appConfig.gitSha})</span>
            {/if}
          </a>
          {#if IS_BETA}<BetaBadge />{/if}
        </p>
      </div>
    </div>
  {/if}
</div>
