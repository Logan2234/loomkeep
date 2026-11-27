<script lang="ts">
  import { API_URL } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import NewBadge from "#lib/premium/NewBadge.svelte";
  import { isFeatureNew } from "#lib/shell/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getCalendarToken, regenerateCalendarToken } from "../api";
  import FeedLink from "../feeds/FeedLink.svelte";
  import FeedLinksModal from "../feeds/FeedLinksModal.svelte";

  let { onclose }: { onclose: () => void } = $props();

  // One token feeds the calendar, the premieres and the release feed alike:
  // all three are the same calendar, read by different apps.
  const linkUrl = (path: string, token: string): string =>
    `${API_URL}/library/${path}?token=${token}`;
</script>

<FeedLinksModal
  title={m.calendar_subscribe_button()}
  tokenKey={keys.calendarSubscribe.token()}
  getToken={getCalendarToken}
  regenerateToken={regenerateCalendarToken}
  confirm={m.calendar_link_regenerate_confirm()}
  privacy={m.calendar_subscription_private()}
  {onclose}>
  {#snippet children(token)}
    <div class="flex flex-col gap-6">
      <section class="flex flex-col gap-3">
        <div>
          <h3 class="font-semibold">{m.calendar_subscription_title()}</h3>
          <p class="text-dim mt-1 text-sm">
            {m.calendar_subscription_description()}
          </p>
        </div>
        <FeedLink url={linkUrl("calendar.ics", token)} />
      </section>
      <section class="flex flex-col gap-3">
        <div>
          <h3 class="flex items-center gap-2 font-semibold">
            {m.calendar_premieres_feed_title()}
            {#if isFeatureNew("premieres")}<NewBadge />{/if}
          </h3>
          <p class="text-dim mt-1 text-sm">
            {m.calendar_premieres_feed_description()}
          </p>
        </div>
        <FeedLink url={linkUrl("premieres.ics", token)} />
      </section>
      <section class="flex flex-col gap-3">
        <div>
          <h3 class="font-semibold">{m.calendar_feed_title()}</h3>
          <p class="text-dim mt-1 text-sm">{m.calendar_feed_description()}</p>
        </div>
        <FeedLink
          url={linkUrl("releases.rss", token)}
          label={m.calendar_feed_rss_label()} />
        <FeedLink
          url={linkUrl("releases.atom", token)}
          label={m.calendar_feed_atom_label()} />
      </section>
    </div>
  {/snippet}
</FeedLinksModal>
