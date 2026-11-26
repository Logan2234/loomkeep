<script lang="ts">
  import { FEEDBACK_URL } from "#lib/constants/external-links.js";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";

  // Unlike the other legal documents, written through the catalogs: it is
  // read above all by the people it concerns, in their own language.
  const CONTACT_EMAIL = "contact@loomkeep.app";
  const UPDATED_ON = "2026-11-26";
</script>

<svelte:head>
  <title>{m.accessibility_page_title()} - Loomkeep</title>
  <meta name="description" content={m.accessibility_page_description()} />
</svelte:head>

<main class="mx-auto max-w-3xl px-5 py-10 md:py-16">
  <header class="border-border mb-10 border-b pb-8 md:mb-14">
    <p class="timecode mb-4 text-xs tracking-[0.16em] uppercase">
      {m.accessibility_eyebrow()}
    </p>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
      {m.accessibility_page_title()}
    </h1>
    <p class="text-dim mt-4 max-w-[62ch]">{m.accessibility_lead()}</p>
  </header>

  <article class="legal-document">
    <p><em>{m.accessibility_updated({ date: formatDate(UPDATED_ON) })}</em></p>

    <h2>{m.accessibility_target_heading()}</h2>
    <p>{m.accessibility_target_body()}</p>

    <h2>{m.accessibility_tested_heading()}</h2>
    <ul>
      <li>{m.accessibility_tested_components()}</li>
      <li>{m.accessibility_tested_pages()}</li>
      <li>{m.accessibility_tested_lighthouse()}</li>
      <li>{m.accessibility_tested_roles()}</li>
    </ul>

    <h2>{m.accessibility_untested_heading()}</h2>
    <ul>
      <li>{m.accessibility_untested_screen_readers()}</li>
      <li>{m.accessibility_untested_catalog_pages()}</li>
      <li>{m.accessibility_untested_catalog_content()}</li>
    </ul>

    <h2>{m.accessibility_settings_heading()}</h2>
    <p>{m.accessibility_settings_body()}</p>

    <h2>{m.accessibility_report_heading()}</h2>
    <p>{m.accessibility_report_body()}</p>
    <ul>
      <li>
        <a href="mailto:{CONTACT_EMAIL}" class="link-accent">{CONTACT_EMAIL}</a>
      </li>
      <li>
        <a
          href={FEEDBACK_URL}
          class="link-accent"
          target="_blank"
          rel="noopener noreferrer">
          {FEEDBACK_URL.replace("https://", "")}
        </a>
      </li>
    </ul>
    <p>{m.accessibility_report_self_hosted()}</p>
  </article>
</main>
