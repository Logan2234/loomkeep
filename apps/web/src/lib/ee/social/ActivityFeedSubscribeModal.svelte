<script lang="ts">
  import { API_URL } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getActivityFeedToken, regenerateActivityFeedToken } from "../api";
  import FeedLink from "../feeds/FeedLink.svelte";
  import FeedLinksModal from "../feeds/FeedLinksModal.svelte";

  let { onclose }: { onclose: () => void } = $props();
</script>

<FeedLinksModal
  title={m.activity_feed_subscribe_button()}
  tokenKey={keys.activityFeedSubscribe.token()}
  getToken={getActivityFeedToken}
  regenerateToken={regenerateActivityFeedToken}
  confirm={m.activity_feed_link_regenerate_confirm()}
  privacy={m.activity_feed_subscription_private()}
  {onclose}>
  {#snippet children(token)}
    <p class="text-dim text-sm">
      {m.activity_feed_subscription_description()}
    </p>
    <div class="mt-4">
      <FeedLink url={`${API_URL}/social/activity.atom?token=${token}`} />
    </div>
  {/snippet}
</FeedLinksModal>
