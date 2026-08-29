<script lang="ts">
  import { acceptTerms } from "$lib/api/client";
  import { m } from "$lib/paraglide/messages.js";
  import Banner from "./Banner.svelte";
  import Modal from "./Modal.svelte";

  let checked = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await acceptTerms();
    } catch {
      error = m.terms_reacceptance_error();
    } finally {
      loading = false;
    }
  }
</script>

<Modal
  dismissable={false}
  title={m.terms_reacceptance_title()}
  onclose={() => {}}
  blur>
  <form onsubmit={submit} class="flex flex-col gap-4">
    <p class="text-dim text-sm leading-relaxed">
      {m.terms_reacceptance_body()}
    </p>
    <label class="text-dim flex items-start gap-2 text-sm leading-relaxed">
      <input type="checkbox" bind:checked required class="mt-0.5" />
      <span>
        {m.auth_register_accept_terms_prefix()}
        <a
          href="/legal/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-text btn-text-underline text-accent hover:text-accent"
          >{m.common_terms()}</a
        >.
      </span>
    </label>
    {#if error}<Banner variant="error">{error}</Banner>{/if}
    <button
      type="submit"
      class="btn btn-primary"
      disabled={loading || !checked}>
      {loading ? m.terms_reacceptance_action_loading() : m.common_continue()}
    </button>
  </form>
</Modal>
