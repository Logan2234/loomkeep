<script lang="ts">
  import {
    getGhostSwitchImpact,
    getPrivacySettings,
    updateMe,
    updatePrivacySettings,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { m } from "$lib/paraglide/messages.js";
  import {
    ACCESS,
    ACCESS_OPTIONS,
    AUDIENCES,
    FACETS,
    MODE_MATRIX,
  } from "$lib/privacy-options";
  import {
    Domain,
    ProfileAccess,
    type ReviewVisibility,
    VisibilityAudience,
    VisibilityFacet,
    type VisibilitySettingsDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";

  let showModesModal = $state(false);
  let confirmingGhost = $state(false);

  const queryClient = useQueryClient();
  const settingsKey = keys.privacy.settings();

  const settingsQuery = createApiQuery(() => ({
    key: settingsKey,
    fetch: getPrivacySettings,
    errorToast: true,
  }));
  const settings = $derived(settingsQuery.data);

  function patchSettings(updated: VisibilitySettingsDto) {
    queryClient.setQueryData(settingsKey, updated);
  }

  const audienceOf = (
    domain: Domain,
    facet: VisibilityFacet,
  ): VisibilityAudience =>
    settings?.settings.find((s) => s.domain === domain && s.facet === facet)
      ?.audience ?? VisibilityAudience.FRIENDS;

  const accessMut = createApiMutation(() => ({
    mutate: (access: ProfileAccess) =>
      updatePrivacySettings({ profileAccess: access }),
    onSuccess: patchSettings,
    errorToast: true,
  }));

  // Consequential + immediate (followers removed, lists downgraded) — show
  // live counts and require confirmation before applying the GHOST switch.
  const ghostImpactMut = createApiMutation(() => ({
    mutate: () => getGhostSwitchImpact(),
    onSuccess: () => (confirmingGhost = true),
    errorToast: true,
  }));
  const ghostImpact = $derived(ghostImpactMut.data);

  function setAccess(access: ProfileAccess) {
    if (!settings || settings.profileAccess === access) return;
    if (access === ProfileAccess.GHOST) {
      ghostImpactMut.mutate();
      return;
    }
    accessMut.mutate(access);
  }

  const ghostSwitchMut = createApiMutation(() => ({
    mutate: () => updatePrivacySettings({ profileAccess: ProfileAccess.GHOST }),
    onSuccess: (updated) => {
      patchSettings(updated);
      confirmingGhost = false;
    },
    errorToast: true,
  }));

  function confirmGhostSwitch() {
    ghostSwitchMut.mutate();
  }

  const audienceMut = createApiMutation(() => ({
    mutate: (args: {
      domain: Domain;
      facet: VisibilityFacet;
      audience: VisibilityAudience;
    }) => updatePrivacySettings({ settings: [args] }),
    onSuccess: patchSettings,
    errorToast: true,
  }));

  function setAudience(
    domain: Domain,
    facet: VisibilityFacet,
    audience: VisibilityAudience,
  ) {
    if (!settings) return;
    audienceMut.mutate({ domain, facet, audience });
  }

  const reviewVisibilityMut = createApiMutation(() => ({
    mutate: (v: ReviewVisibility) => updateMe({ defaultReviewVisibility: v }),
    errorToast: true,
  }));

  function setDefaultReviewVisibility(v: ReviewVisibility) {
    if (auth.user?.defaultReviewVisibility === v) return;
    reviewVisibilityMut.mutate(v);
  }

  const hideProgressionMut = createApiMutation(() => ({
    mutate: (hideProgression: boolean) => updateMe({ hideProgression }),
    errorToast: true,
  }));

  function toggleHideProgression() {
    if (!auth.user) return;
    hideProgressionMut.mutate(!auth.user.hideProgression);
  }

  let isPrivate = $derived(settings?.profileAccess !== ProfileAccess.PUBLIC);

  // Only domains the user actually kept visible (see enabledDomains on
  // UserDto) — otherwise a disabled/never-enabled domain (e.g. Livres off,
  // or the early-access ones on a free account) would still show a row here
  // even though it's absent everywhere else in the app.
  const visibleDomainEntries = $derived(
    Object.entries(DOMAINS).filter(
      ([id, domain]) =>
        !domain.comingSoon && auth.user?.enabledDomains.includes(id as Domain),
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
      disabledReason: m.settings_private_profile_public_hint(),
    }))}
    value={current}
    onChange={(v) => setAudience(domain, facet, v)} />
{/snippet}

{#if appConfig.socialEnabled && settings}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">{m.common_privacy()}</h2>
    <p class="text-dim text-sm">
      {m.settings_privacy_description()}
    </p>

    <div class="my-8">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p class="font-semibold">{m.settings_profile_visibility()}</p>
        <button
          type="button"
          class="text-dim decoration-dim/50 cursor-pointer text-xs underline decoration-dotted underline-offset-4"
          onclick={() => (showModesModal = true)}>
          {m.common_learn_more()}
        </button>
      </div>
      <Combobox
        label={m.settings_privacy_profile_label()}
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
              <th class="pr-3 pb-2 font-semibold">{m.common_category()}</th>
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
                {m.settings_privacy_default_reviews()}
              </p>
              <p class="text-dim text-sm">
                {m.settings_privacy_default_reviews_hint()}
              </p>
            </div>
            <Combobox
              label={m.settings_privacy_scope()}
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

    {#if appConfig.gamificationEnabled && auth.user}
      <div class="border-border mt-5 border-t pt-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-semibold">{m.settings_hide_progression()}</p>
            <p class="text-dim text-sm">
              {m.settings_hide_progression_desc()}
            </p>
          </div>
          <Switch
            label={m.settings_hide_progression()}
            checked={auth.user.hideProgression}
            onChange={toggleHideProgression} />
        </div>
      </div>
    {/if}

    <p class="text-dim mt-4 text-xs">
      {m.settings_privacy_content_hint()}
    </p>
  </section>
{/if}

{#if showModesModal}
  <Modal
    title={m.settings_privacy_modes_title()}
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
            <th class="py-2 pr-3 font-semibold">{m.common_action()}</th>
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
  <Modal
    title={m.settings_privacy_ghost_title()}
    onclose={() => (confirmingGhost = false)}>
    <p class="text-dim text-sm">
      {m.settings_privacy_ghost_description()}
    </p>
    <ul class="border-border divide-border mt-3 divide-y border-y text-sm">
      {#if ghostImpact.followersToRemove > 0}
        <li class="flex items-center justify-between gap-3 py-2">
          <span
            >{ghostImpact.followersToRemove > 1
              ? m.settings_privacy_removed_followers()
              : m.settings_privacy_removed_follower()}</span>
          <span class="timecode text-fg font-semibold"
            >{ghostImpact.followersToRemove}</span>
        </li>
      {/if}
      {#if ghostImpact.outgoingFollowsToCancel > 0}
        <li class="flex items-center justify-between gap-3 py-2">
          <span>{m.settings_privacy_cancelled_following()}</span>
          <span class="timecode text-fg font-semibold"
            >{ghostImpact.outgoingFollowsToCancel}</span>
        </li>
      {/if}
      {#if ghostImpact.listsToDowngrade > 0}
        <li class="flex items-center justify-between gap-3 py-2">
          <span
            >{ghostImpact.listsToDowngrade > 1
              ? m.settings_privacy_private_lists()
              : m.settings_privacy_private_list()}</span>
          <span class="timecode text-fg font-semibold"
            >{ghostImpact.listsToDowngrade}</span>
        </li>
      {/if}
      {#if ghostImpact.followersToRemove === 0 && ghostImpact.outgoingFollowsToCancel === 0 && ghostImpact.listsToDowngrade === 0}
        <li class="text-dim py-2">
          {m.settings_privacy_nothing_to_clean()}
        </li>
      {/if}
    </ul>
    <p class="text-dim mt-4 text-xs">
      {m.settings_privacy_anonymity_warning()}
    </p>
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={ghostSwitchMut.loading}
        onclick={() => (confirmingGhost = false)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        disabled={ghostSwitchMut.loading}
        onclick={confirmGhostSwitch}>
        {m.settings_privacy_become_ghost()}
      </button>
    </div>
  </Modal>
{/if}
