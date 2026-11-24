<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import PremiumLockBadge from "#lib/components/PremiumLockBadge.svelte";
  import TabPanels from "#lib/components/TabPanels.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import CalendarSubscribeModal from "#lib/ee/calendar/CalendarSubscribeModal.svelte";
  import { useEeLock } from "#lib/ee/license.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import MyCalendarView from "./components/MyCalendarView.svelte";
  import PremieresView from "./components/PremieresView.svelte";

  const eeLock = useEeLock();
  const calendarLocked = $derived(eeLock.locked);

  let showSubscribeModal = $state(false);

  // Both views live on this one page, so switching slides the tab's underline
  // and cross-fades the content; the query keeps a view linkable.
  type View = "mine" | "premieres";
  const viewTabs: { value: View; label: string; isNew?: boolean }[] = [
    { value: "mine", label: m.calendar_view_mine() },
    {
      value: "premieres",
      label: m.calendar_view_premieres(),
      isNew: isFeatureNew("premieres"),
    },
  ];
  const view = $derived<View>(
    page.url.searchParams.get("view") === "premieres" ? "premieres" : "mine",
  );

  function selectView(next: View) {
    void goto(next === "premieres" ? "?view=premieres" : "/app/calendar");
  }
</script>

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <div class="relative">
    <PageHeader
      back="/app"
      backInHistory
      backOnPhoneOnly
      icon="calendar"
      title={m.common_calendar()}>
      {#snippet actions()}
        {#if !layout.compact}
          {#snippet calendarButton()}
            <button
              class="btn btn-ghost shrink-0"
              disabled={calendarLocked}
              onclick={() => (showSubscribeModal = true)}>
              <Icon name="calendar" class="mr-1.5 inline h-4 w-4" />
              {m.calendar_subscribe_button()}
            </button>
          {/snippet}
          {#if calendarLocked}
            <Tooltip text={m.premium_locked()} class="inline-flex shrink-0">
              {@render calendarButton()}
              <PremiumLockBadge />
            </Tooltip>
          {:else}
            {@render calendarButton()}
          {/if}
        {/if}
      {/snippet}
    </PageHeader>
    {#if layout.compact}
      <!-- On the title's line: a phone has no room to wrap it below. -->
      <div class="absolute top-0 right-0">
        <Dropdown placement="bottom-end" class="min-w-60">
          {#snippet trigger({ open, toggle, onkeydown })}
            <button
              type="button"
              class="btn-icon-bordered"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={m.common_more_actions()}
              title={m.common_more_actions()}
              onclick={toggle}
              {onkeydown}>
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              disabled={calendarLocked}
              title={calendarLocked ? m.premium_locked() : undefined}
              onclick={() => {
                close();
                showSubscribeModal = true;
              }}>
              <Icon name="calendar" class="h-4 w-4" />
              {m.calendar_subscribe_button()}
              {#if calendarLocked}
                <PremiumLockBadge />
              {/if}
            </button>
          {/snippet}
        </Dropdown>
      </div>
    {/if}
  </div>
  <Tabs
    class="mb-5"
    label={m.calendar_view_label()}
    tabs={viewTabs}
    current={view}
    idPrefix="calendar-view"
    onSelect={selectView} />

  <TabPanels current={view} idPrefix="calendar-view">
    {#if view === "premieres"}
      <PremieresView />
    {:else}
      <MyCalendarView />
    {/if}
  </TabPanels>
</div>

{#if showSubscribeModal}
  <CalendarSubscribeModal onclose={() => (showSubscribeModal = false)} />
{/if}
