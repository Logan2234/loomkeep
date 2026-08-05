<script lang="ts">
  // "Social" section of /stats — gated by SOCIAL_ENABLED (see the page,
  // this component is only mounted when appConfig.socialEnabled is true).
  // Always cross-domain, not affected by the DomainFilter.
  import type { SocialStatsDto } from "@tracklore/shared";
  import { getSocialStats } from "$lib/api/stats";
  import { ApiError } from "$lib/api/core";
  import LineChart from "./LineChart.svelte";
  import StatTile from "./StatTile.svelte";
  import StatTilesSkeleton from "./StatTilesSkeleton.svelte";

  let social = $state<SocialStatsDto | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    getSocialStats()
      .then((s) => (social = s))
      .catch((e) => {
        error =
          e instanceof ApiError
            ? e.message
            : "Statistiques sociales indisponibles";
      })
      .finally(() => (loading = false));
  });

  const pf = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  });

  /** How the viewer's average reads against the community's. */
  function verdict(delta: number): string {
    if (delta < 0) return "plus sévère";
    if (delta > 0) return "plus généreux";
    return "aligné";
  }

  const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const toPoints = (rows: { month: string; count: number }[]) =>
    rows.map((r) => ({
      label: monthFmt.format(new Date(`${r.month}-01T00:00:00Z`)),
      value: r.count,
    }));
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if loading}
  <StatTilesSkeleton />
{:else if social}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile
      value={social.reviewsWritten}
      label="Critiques écrites"
      hint={social.avgReviewLength !== null
        ? `longueur moy. ${social.avgReviewLength} signes`
        : undefined} />
    <StatTile
      value={social.commentsWritten}
      label="Commentaires"
      hint="{pf.format(social.spoilerCommentRatio)} marqués spoiler" />
    <StatTile
      value={social.helpfulVotesReceived}
      label="Votes « utile » reçus"
      hint={social.mostVotedReviewVotes !== null
        ? `critique la + votée : ${social.mostVotedReviewVotes}`
        : undefined} />
    <StatTile
      value={social.listsWritten}
      label="Listes publiées"
      hint="{social.listsPublicCount} publiques" />
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Commentaires : racines vs réponses
      </h3>
      <div class="flex items-baseline gap-6">
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.rootCommentsCount}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">Racines</p>
        </div>
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.replyCommentsCount}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">Réponses</p>
        </div>
      </div>
    </section>

    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Révisions &amp; réactions
      </h3>
      <div class="flex flex-wrap items-baseline gap-6">
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.reviewRevisionsCount}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            Révisions de critiques
          </p>
        </div>
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.reactionsGiven}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            Réactions données
          </p>
        </div>
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.reactionsReceived}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            Réactions reçues
          </p>
        </div>
      </div>
    </section>
  </div>

  <section class="card mt-5 p-5">
    <h3 class="font-display text-lg font-bold">Ta note vs la communauté</h3>
    {#if social.ratingVsCommunity.sufficientData}
      {@const cmp = social.ratingVsCommunity}
      {@const delta =
        Math.round((cmp.yourAverage - cmp.communityAverage) * 10) / 10}
      <p class="text-dim mb-3 text-sm">
        Sur les {cmp.sampleSize} œuvres notées en commun — es-tu sévère ou généreux
        ?
      </p>
      <span class="chip chip-on mb-3 inline-block text-xs">
        {delta > 0 ? "+" : ""}{delta} pt{Math.abs(delta) > 1 ? "s" : ""} · {verdict(
          delta,
        )}
      </span>
      <div class="bg-surface-2 relative h-2 rounded-full">
        <span
          class="border-fg absolute top-1/2 h-3 w-0.5 -translate-y-1/2 border-l-2"
          style="left:{(cmp.communityAverage / 10) * 100}%"
          title="communauté {cmp.communityAverage}/10"></span>
        <span
          class="bg-accent absolute top-1/2 h-3 w-0.5 -translate-y-1/2"
          style="left:{(cmp.yourAverage / 10) * 100}%"
          title="toi {cmp.yourAverage}/10"></span>
      </div>
      <p class="timecode mt-2 text-xs">
        toi {cmp.yourAverage} · communauté {cmp.communityAverage}
      </p>
    {:else}
      <p class="text-dim text-sm">
        Pas assez d’œuvres notées en commun avec d’autres membres pour comparer
        ({social.ratingVsCommunity.sampleSize} pour l’instant).
      </p>
    {/if}
  </section>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Nouveaux abonnés par mois
      </h3>
      <p class="text-dim mb-3 text-xs">
        Réciprocité : {pf.format(social.followerReciprocityRate)} suivis en retour
      </p>
      <LineChart
        points={toPoints(social.newFollowersByMonth)}
        color="var(--accent)" />
    </section>
    <section class="card p-5">
      <div class="mb-4 flex items-baseline justify-between">
        <h3 class="font-display text-lg font-bold">
          Activité sociale par mois
        </h3>
        {#if social.contributionStreakDays > 0}
          <span class="text-dim text-xs"
            >série en cours : <b class="text-fg"
              >{social.contributionStreakDays} j</b
            ></span>
        {/if}
      </div>
      <LineChart
        points={toPoints(social.socialActivityByMonth)}
        color="var(--accent)" />
    </section>
  </div>
{/if}
