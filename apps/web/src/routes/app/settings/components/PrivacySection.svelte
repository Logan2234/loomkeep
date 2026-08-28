<script lang="ts">
  import {
    getGhostSwitchImpact,
    getPrivacySettings,
    updateMe,
    updatePrivacySettings,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { m } from "$lib/paraglide/messages.js";
  import {
    Domain,
    type GhostSwitchImpactDto,
    ProfileAccess,
    type ReviewVisibility,
    VisibilityAudience,
    VisibilityFacet,
    type VisibilitySettingsDto,
  } from "@loomkeep/shared";

  const ACCESS: { id: ProfileAccess; label: string; desc: string }[] = [
    {
      id: ProfileAccess.PUBLIC,
      label: m.common_public(),
      desc: "Tout le monde peut vous trouver et vous suivre librement.",
    },
    {
      id: ProfileAccess.PRIVATE,
      label: m.common_private(),
      desc: "Vous validez chaque demande ; seuls vos amis voient votre contenu.",
    },
    {
      id: ProfileAccess.GHOST,
      label: m.profile_ghost(),
      desc: "Invisible : personne ne peut vous trouver, vous suivre, ni voir votre activité. Vous pouvez suivre et commenter de façon anonyme.",
    },
  ];

  const ACCESS_OPTIONS = ACCESS.map((a) => ({ id: a.id, label: a.label }));

  const FACETS: { id: VisibilityFacet; label: string }[] = [
    { id: VisibilityFacet.LIBRARY, label: m.common_library() },
    { id: VisibilityFacet.ACTIVITY, label: m.common_activity() },
  ];

  const AUDIENCES: { id: VisibilityAudience; label: string }[] = [
    { id: VisibilityAudience.PUBLIC, label: m.common_public() },
    { id: VisibilityAudience.FRIENDS, label: m.common_friends() },
    { id: VisibilityAudience.NONE, label: "Personne" },
  ];

  // The modal's matrix — actions × the 3 modes (from the P4 cadrage plan).
  const MODE_MATRIX: {
    action: string;
    public: string;
    private: string;
    ghost: string;
  }[] = [
    { action: "Trouvable en recherche", public: "✓", private: "✓", ghost: "✗" },
    {
      action: "Profil consultable",
      public: "✓",
      private: m.common_friends(),
      ghost: "✗",
    },
    {
      action: "Peut être suivi",
      public: "Librement",
      private: "Sur demande",
      ghost: "✗",
    },
    {
      action: "Peut suivre",
      public: "✓",
      private: "✓",
      ghost: "Profils publics",
    },
    { action: "Devenir ami", public: "✓", private: "✓", ghost: "✗" },
    {
      action: "Voir le contenu Public / Amis",
      public: "✓ / ✓",
      private: "✓ / ✓",
      ghost: "✓ / ✗",
    },
    {
      action: "Commenter + réagir",
      public: "✓",
      private: "✓",
      ghost: "Anonyme",
    },
    {
      action: "Publier des reviews",
      public: "✓",
      private: "✓",
      ghost: "Hors moyenne",
    },
    {
      action: "Apparaître dans le fil d'autrui",
      public: "✓",
      private: m.common_friends(),
      ghost: "✗",
    },
    {
      action: "Être mentionné / nom cliquable",
      public: "✓",
      private: "✓ (verrouillé)",
      ghost: "✗",
    },
  ];

  let settings = $state<VisibilitySettingsDto | null>(null);
  let showModesModal = $state(false);
  let savingDefaultReviewVisibility = $state(false);
  let ghostImpact = $state<GhostSwitchImpactDto | null>(null);
  let confirmingGhost = $state(false);
  let switchingToGhost = $state(false);

  $effect(() => {
    void getPrivacySettings().then((s) => (settings = s));
  });

  function audienceOf(
    domain: Domain,
    facet: VisibilityFacet,
  ): VisibilityAudience {
    return (
      settings?.settings.find((s) => s.domain === domain && s.facet === facet)
        ?.audience ?? VisibilityAudience.FRIENDS
    );
  }

  async function setAccess(access: ProfileAccess) {
    if (!settings || settings.profileAccess === access) return;

    if (access === ProfileAccess.GHOST) {
      // Consequential + immediate (followers removed, lists downgraded) —
      // show live counts and require confirmation before applying it.
      ghostImpact = await getGhostSwitchImpact();
      confirmingGhost = true;
      return;
    }

    settings = await updatePrivacySettings({ profileAccess: access });
  }

  async function confirmGhostSwitch() {
    if (switchingToGhost) return;
    switchingToGhost = true;
    try {
      settings = await updatePrivacySettings({
        profileAccess: ProfileAccess.GHOST,
      });
      confirmingGhost = false;
    } finally {
      switchingToGhost = false;
    }
  }

  async function setAudience(
    domain: Domain,
    facet: VisibilityFacet,
    audience: VisibilityAudience,
  ) {
    if (!settings) return;
    settings = await updatePrivacySettings({
      settings: [{ domain, facet, audience }],
    });
  }

  async function setDefaultReviewVisibility(v: ReviewVisibility) {
    if (
      savingDefaultReviewVisibility ||
      auth.user?.defaultReviewVisibility === v
    )
      return;
    savingDefaultReviewVisibility = true;
    try {
      await updateMe({ defaultReviewVisibility: v });
    } finally {
      savingDefaultReviewVisibility = false;
    }
  }

  let isPrivate = $derived(settings?.profileAccess !== ProfileAccess.PUBLIC);

  // Only domains the user actually kept visible (see enabledDomains on
  // UserDto) — otherwise a disabled/never-enabled domain (e.g. Livres off,
  // or the early-access ones on a free account) would still show a row here
  // even though it's absent everywhere else in the app.
  const visibleDomainEntries = $derived(
    Object.entries(DOMAINS).filter(([id]) =>
      auth.user?.enabledDomains.includes(id as Domain),
    ) as [Domain, (typeof DOMAINS)[Domain]][],
  );
</script>

{#snippet audienceSegmented(
  domain: Domain,
  facet: VisibilityFacet,
  current: VisibilityAudience,
)}
  <SegmentedControl
    options={AUDIENCES.map((a) => ({
      value: a.id,
      label: a.label,
      disabled: isPrivate && a.id === VisibilityAudience.PUBLIC,
      disabledReason: "Un profil privé ne peut pas exposer au public.",
    }))}
    value={current}
    onChange={(v) => setAudience(domain, facet, v)} />
{/snippet}

{#if appConfig.socialEnabled && settings}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">{m.common_privacy()}</h2>
    <p class="text-dim text-sm">
      Qui peut vous trouver, et ce que les autres voient de vous.
    </p>

    <div class="my-8">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p class="font-semibold">Visibilité du profil</p>
        <button
          type="button"
          class="text-dim decoration-dim/50 cursor-pointer text-xs underline decoration-dotted underline-offset-4"
          onclick={() => (showModesModal = true)}>
          En savoir plus
        </button>
      </div>
      <Combobox
        label="Profil"
        options={ACCESS_OPTIONS.map((a) => ({ label: a.label, value: a.id }))}
        values={settings.profileAccess ? [settings.profileAccess] : []}
        onChange={(v) => setAccess(v[0] as ProfileAccess)} />
    </div>

    {#if settings.profileAccess !== ProfileAccess.GHOST}
      <!-- Visibility matrix: the authZ layer, per domain × facet. A table on
           desktop (12 cells scannable at once) doesn't fit a phone screen —
           the segmented control alone is wider than the "Activité" column —
           so under md it drops to one stacked block per domain instead,
           same control, same data. -->
      <div class="divide-border divide-y md:hidden">
        {#each visibleDomainEntries as [domainId, domainInfo] (domainId)}
          <div class="py-3 first:pt-0">
            <p class="mb-2 font-semibold">{domainInfo.label}</p>
            <div class="space-y-2">
              {#each FACETS as f (f.id)}
                {@const current = audienceOf(domainId as Domain, f.id)}
                <div class="flex items-center justify-between gap-2">
                  <span class="text-dim text-sm">{f.label}</span>
                  {@render audienceSegmented(domainId as Domain, f.id, current)}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-border border-b">
              <th class="pr-3 pb-2 font-semibold">Catégorie</th>
              {#each FACETS as f (f.id)}
                <th class="px-3 pb-2 text-center font-semibold">{f.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            {#each visibleDomainEntries as [domainId, domainInfo] (domainId)}
              <tr>
                <td class="py-2.5 pr-3 font-semibold whitespace-nowrap"
                  >{domainInfo.label}</td>
                {#each FACETS as f (f.id)}
                  {@const current = audienceOf(domainId as Domain, f.id)}
                  <td class="px-3 py-2.5 text-center">
                    {@render audienceSegmented(
                      domainId as Domain,
                      f.id,
                      current,
                    )}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if auth.user}
        <div class="border-border mt-5 border-y py-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="font-semibold">
                Portée par défaut des nouvelles reviews
              </p>
              <p class="text-dim text-sm">
                Utilisée quand vous notez une œuvre sans préciser la portée.
              </p>
            </div>
            <Combobox
              label="Portée"
              options={[
                { label: m.common_friends(), value: "FRIENDS" },
                { label: m.common_public(), value: "PUBLIC" },
              ]}
              values={[auth.user.defaultReviewVisibility]}
              onChange={(v) =>
                setDefaultReviewVisibility(v[0] as ReviewVisibility)} />
          </div>
        </div>
      {/if}
    {/if}

    <p class="text-dim mt-4 text-xs">
      Vos notes privées restent toujours privées. Les reviews et commentaires
      que vous publiez ont leur propre portée, choisie à la publication.
    </p>
  </section>
{/if}

{#if showModesModal}
  <Modal
    title="Les 3 modes de confidentialité"
    wide
    onclose={() => (showModesModal = false)}>
    <div class="space-y-3">
      {#each ACCESS as a (a.id)}
        <div>
          <p class="font-semibold">{a.label}</p>
          <p class="text-dim text-sm">{a.desc}</p>
        </div>
      {/each}
    </div>
    <div class="mt-5 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-border border-b">
            <th class="py-2 pr-3 font-semibold">Action</th>
            <th class="px-3 py-2 font-semibold">{m.common_public()}</th>
            <th class="px-3 py-2 font-semibold">{m.common_private()}</th>
            <th class="py-2 pl-3 font-semibold">{m.profile_ghost()}</th>
          </tr>
        </thead>
        <tbody class="divide-border divide-y">
          {#each MODE_MATRIX as row (row.action)}
            <tr>
              <td class="text-dim py-2 pr-3">{row.action}</td>
              <td class="px-3 py-2">{row.public}</td>
              <td class="px-3 py-2">{row.private}</td>
              <td class="py-2 pl-3">{row.ghost}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Modal>
{/if}

{#if confirmingGhost && ghostImpact}
  <Modal title="Passer en Figurant ?" onclose={() => (confirmingGhost = false)}>
    <p class="text-dim text-sm">
      Vous devenez invisible : introuvable, non suivable, activité masquée. Cela
      applique tout de suite :
    </p>
    <ul class="border-border divide-border mt-3 divide-y border-y text-sm">
      {#if ghostImpact.followersToRemove > 0}
        <li class="flex items-center justify-between gap-3 py-2">
          <span
            >{ghostImpact.followersToRemove > 1
              ? "Abonnés retirés"
              : "Abonné retiré"}</span>
          <span class="timecode text-fg font-semibold"
            >{ghostImpact.followersToRemove}</span>
        </li>
      {/if}
      {#if ghostImpact.outgoingFollowsToCancel > 0}
        <li class="flex items-center justify-between gap-3 py-2">
          <span>Abonnements/demandes annulés (profils non publics)</span>
          <span class="timecode text-fg font-semibold"
            >{ghostImpact.outgoingFollowsToCancel}</span>
        </li>
      {/if}
      {#if ghostImpact.listsToDowngrade > 0}
        <li class="flex items-center justify-between gap-3 py-2">
          <span
            >{ghostImpact.listsToDowngrade > 1
              ? "Listes repassées en Privé"
              : "Liste repassée en Privé"}</span>
          <span class="timecode text-fg font-semibold"
            >{ghostImpact.listsToDowngrade}</span>
        </li>
      {/if}
      {#if ghostImpact.followersToRemove === 0 && ghostImpact.outgoingFollowsToCancel === 0 && ghostImpact.listsToDowngrade === 0}
        <li class="text-dim py-2">
          Rien à nettoyer pour l'instant — aucun impact immédiat.
        </li>
      {/if}
    </ul>
    <p class="text-dim mt-4 text-xs">
      L'anonymat n'est pas permanent : repasser Public ou Privé réattribuera
      votre historique (commentaires, reviews) à votre identité réelle.
    </p>
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={switchingToGhost}
        onclick={() => (confirmingGhost = false)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        disabled={switchingToGhost}
        onclick={confirmGhostSwitch}>
        Devenir Figurant
      </button>
    </div>
  </Modal>
{/if}
