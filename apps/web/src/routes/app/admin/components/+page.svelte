<script lang="ts">
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import BetaBadge from "$lib/components/BetaBadge.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import FieldError from "$lib/components/FieldError.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "$lib/components/PosterGridSkeleton.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProviderMark from "$lib/components/ProviderMark.svelte";
  import RatingPips from "$lib/components/RatingPips.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import Wizard from "$lib/components/Wizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ProviderBrandKey } from "$lib/provider-brands";
  import type { IconName } from "$lib/types/icon-name";
  import type { Snippet } from "svelte";
  import OverlayShowcase from "./OverlayShowcase.svelte";

  type BannerVariant = "error" | "warning" | "info" | "neutral";
  type ViewMode = "compact" | "comfortable";

  const SECTIONS = [
    { id: "foundations", label: m.admin_components_family_foundations() },
    { id: "forms", label: m.admin_components_family_forms() },
    { id: "feedback", label: m.admin_components_family_feedback() },
    { id: "overlays", label: m.admin_components_family_overlays() },
    { id: "content", label: m.admin_components_family_content() },
  ];

  const BUTTONS: {
    label: string;
    className: string;
    disabled?: boolean;
  }[] = [
    {
      label: m.admin_components_button_primary(),
      className: "btn btn-primary",
    },
    {
      label: "btn-primary-cartouche",
      className: "btn btn-primary btn-primary-cartouche",
    },
    {
      label: m.admin_components_button_secondary(),
      className: "btn btn-ghost",
    },
    { label: m.admin_components_button_danger(), className: "btn btn-danger" },
    { label: "btn-text", className: "btn-text" },
    { label: "link-accent", className: "link-accent" },
    { label: "btn-lg", className: "btn btn-primary btn-lg" },
    {
      label: m.admin_components_button_disabled(),
      className: "btn btn-primary",
      disabled: true,
    },
    { label: "btn-sm", className: "btn btn-primary btn-sm" },
  ];

  const SWATCH_GROUPS = [
    {
      label: "Séance",
      swatches: [
        "bg",
        "surface",
        "surface-2",
        "border",
        "fg",
        "dim",
        "accent",
        "accent-fg",
        "btn",
        "btn-fg",
      ],
    },
    { label: "Semantic", swatches: ["success", "danger", "warning"] },
    {
      label: "Domains",
      swatches: ["stat-media", "stat-games", "stat-books", "stat-music"],
    },
    { label: "Tiers", swatches: ["tier-bronze", "tier-silver", "tier-gold"] },
  ];

  const ICONS: IconName[] = [
    "home",
    "library",
    "search",
    "calendar",
    "stats",
    "user",
    "users",
    "activity",
    "menu",
    "sun",
    "moon",
    "check",
    "star",
    "gamepad",
    "book",
    "chevron-left",
    "chevron-right",
    "chevron-up",
    "chevron-down",
    "download",
    "bell",
    "monitor",
    "plus",
    "trash",
    "x",
    "eye",
    "eye-off",
    "shield",
    "mail",
    "database",
    "gauge",
    "archive",
    "music",
    "tv",
    "podcast",
    "boardgame",
    "refresh",
    "gear",
    "pin",
    "pin-filled",
    "message",
    "flag",
    "reply",
    "list",
    "grip",
    "edit",
    "dots-horizontal",
    "dots-vertical",
    "share",
    "qr-code",
    "camera",
    "link",
    "logout",
    "sparkles",
    "lock",
    "warning",
    "play",
    "trophy",
    "question",
    "flame",
    "compass",
    "hourglass",
    "mask",
    "footprint",
    "shooting-star",
    "circle-arrow",
    "arrow-right",
    "pumpkin",
    "crown",
    "key",
    "send",
  ];

  const BANNERS: { variant: BannerVariant; message: string }[] = [
    { variant: "info", message: m.admin_components_banner_info() },
    { variant: "neutral", message: m.admin_components_banner_neutral() },
    { variant: "warning", message: m.admin_components_banner_warning() },
    { variant: "error", message: m.admin_components_banner_error() },
  ];

  const PROGRESS = [
    {
      label: m.admin_components_progress_started(),
      value: 18,
      fillClass: "bg-accent",
    },
    {
      label: m.admin_components_progress_active(),
      value: 62,
      fillClass: "bg-accent",
    },
    {
      label: m.admin_components_progress_complete(),
      value: 100,
      fillClass: "bg-success",
    },
    {
      label: m.admin_components_progress_danger(),
      value: 84,
      fillClass: "bg-danger",
    },
  ];

  const PROVIDERS: ProviderBrandKey[] = [
    "tmdb",
    "anilist",
    "omdb",
    "igdb",
    "openlibrary",
    "musicbrainz",
  ];
  const CAROUSEL_ITEMS = [
    m.admin_components_sample_title_one(),
    m.admin_components_sample_title_two(),
    m.admin_components_sample_title_three(),
    m.admin_components_sample_title_four(),
    m.admin_components_sample_title_five(),
    m.admin_components_sample_title_six(),
    m.admin_components_sample_title_seven(),
    m.admin_components_sample_title_eight(),
    m.admin_components_sample_title_nine(),
    m.admin_components_sample_title_ten(),
  ];

  let password = $state("Loomkeep-2026");
  let notificationsEnabled = $state(true);
  let viewMode = $state<ViewMode>("compact");
  let genres = $state<string[]>(["drama"]);
  let sources = $state<string[]>(["tmdb", "anilist"]);
  let rating = $state<number | null>(7);
  let wizardStep = $state(0);

  const GENRE_OPTIONS = [
    { value: "drama", label: m.admin_components_option_drama() },
    { value: "comedy", label: m.admin_components_option_comedy() },
    { value: "documentary", label: m.admin_components_option_documentary() },
    { value: "animation", label: m.admin_components_option_animation() },
  ];
  const SOURCE_OPTIONS = [
    { value: "tmdb", label: "TMDB" },
    { value: "anilist", label: "AniList" },
    { value: "igdb", label: "IGDB" },
    { value: "musicbrainz", label: "MusicBrainz" },
  ];

  const relativeDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
</script>

{#snippet specimen(name: string, detail: string, children: Snippet)}
  <article class="border-border border-t pt-5 first:border-t-0 first:pt-0">
    <div
      class="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 class="font-display text-lg font-bold">{name}</h3>
      <p class="timecode text-xs">{detail}</p>
    </div>
    {@render children()}
  </article>
{/snippet}

{#snippet familyHeading(index: number, title: string, description: string)}
  <div class="mb-6 grid gap-2 md:grid-cols-[7rem_1fr] md:gap-6">
    <span class="timecode text-xs"
      >{String(index + 1).padStart(2, "0")} / 05</span>
    <div>
      <h2
        class="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
        {title}
      </h2>
      <p class="text-dim mt-1 max-w-2xl text-sm">{description}</p>
    </div>
  </div>
{/snippet}

<div class="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="compass"
    title={m.admin_components_title()}
    subtitle={m.admin_components_subtitle()}
    back="/app/admin"
    class="mb-5" />

  <div class="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
    <aside
      class="border-border mb-8 border-y py-3 lg:mb-0 lg:border-y-0 lg:border-r lg:py-0 lg:pr-6">
      <nav
        aria-label={m.admin_components_section_navigation()}
        class="no-scrollbar flex gap-2 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:gap-1 lg:overflow-visible">
        {#each SECTIONS as section, index (section.id)}
          <a
            href={"#" + section.id}
            class="chip shrink-0 lg:flex lg:items-center lg:justify-start lg:border-0 lg:px-2 lg:py-2">
            <span class="timecode mr-1 text-[0.65rem]"
              >{String(index + 1).padStart(2, "0")}</span>
            {section.label}
          </a>
        {/each}
      </nav>
    </aside>

    <div class="space-y-14 md:space-y-18">
      <section id="foundations" class="scroll-mt-6">
        {@render familyHeading(
          0,
          m.admin_components_family_foundations(),
          m.admin_components_foundations_desc(),
        )}
        <div class="card space-y-6 p-5 md:p-6">
          {@render specimen(
            "Tokens",
            m.admin_components_tokens_detail(),
            tokens,
          )}
          {@render specimen(
            ".btn",
            m.admin_components_buttons_detail(),
            buttons,
          )}
          {@render specimen("Icon", m.admin_components_icons_detail(), icons)}
          {@render specimen(
            ".chip + badges",
            m.admin_components_badges_detail(),
            badges,
          )}
        </div>
      </section>

      <section id="forms" class="scroll-mt-6">
        {@render familyHeading(
          1,
          m.admin_components_family_forms(),
          m.admin_components_forms_desc(),
        )}
        <div class="card space-y-7 p-5 md:p-6">
          {@render specimen(
            ".input + FieldError",
            m.admin_components_inputs_detail(),
            fields,
          )}
          {@render specimen(
            "PasswordInput",
            m.admin_components_password_detail(),
            passwordField,
          )}
          {@render specimen(
            "Switch + SegmentedControl",
            m.admin_components_controls_detail(),
            controls,
          )}
          {@render specimen(
            "Combobox",
            m.admin_components_combobox_detail(),
            comboboxes,
          )}
          {@render specimen(
            "Wizard",
            m.admin_components_wizard_detail(),
            wizard,
          )}
        </div>
      </section>

      <section id="feedback" class="scroll-mt-6">
        {@render familyHeading(
          2,
          m.admin_components_family_feedback(),
          m.admin_components_feedback_desc(),
        )}
        <div class="card space-y-7 p-5 md:p-6">
          {@render specimen(
            "Banner",
            m.admin_components_banner_detail(),
            banners,
          )}
          {@render specimen(
            "ProgressBar",
            m.admin_components_progress_detail(),
            progressBars,
          )}
          {@render specimen(
            "EmptyState",
            m.admin_components_empty_detail(),
            emptyState,
          )}
          {@render specimen(
            "CardRowSkeleton",
            m.admin_components_loading_detail(),
            loadingState,
          )}
        </div>
      </section>

      <section id="overlays" class="scroll-mt-6">
        {@render familyHeading(
          3,
          m.admin_components_family_overlays(),
          m.admin_components_overlays_desc(),
        )}
        <div class="card p-5 md:p-6">
          <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-display text-lg font-bold">
              Modal · Drawer · Dropdown · Tooltip · Toast
            </h3>
            <p class="timecode text-xs">
              {m.admin_components_overlays_detail()}
            </p>
          </div>
          <OverlayShowcase />
        </div>
      </section>

      <section id="content" class="scroll-mt-6">
        {@render familyHeading(
          4,
          m.admin_components_family_content(),
          m.admin_components_content_desc(),
        )}
        <div class="card space-y-7 p-5 md:p-6">
          {@render specimen(
            "Avatar + RelativeTime",
            m.admin_components_identity_detail(),
            identity,
          )}
          {@render specimen(
            "Poster",
            m.admin_components_poster_detail(),
            posters,
          )}
          {@render specimen(
            "PosterGrid + PosterCard",
            m.admin_components_poster_grid_detail(),
            posterCollections,
          )}
          {@render specimen(
            "ProviderMark",
            m.admin_components_provider_detail(),
            providers,
          )}
          {@render specimen(
            "RatingPips",
            m.admin_components_rating_detail(),
            ratings,
          )}
          {@render specimen(
            "Carousel",
            m.admin_components_carousel_detail(),
            carousel,
          )}
        </div>
      </section>
    </div>
  </div>
</div>

{#snippet tokens()}
  <div class="grid gap-6 xl:grid-cols-[15rem_1fr]">
    <div class="space-y-3">
      <p class="font-display text-2xl font-extrabold">Bricolage Grotesque</p>
      <p class="text-sm">Hanken Grotesk — {m.admin_components_body_sample()}</p>
      <p class="timecode text-xs tracking-wide">00:42:16 · S02E07 · 18 / 24</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      {#each SWATCH_GROUPS as group (group.label)}
        <section>
          <p class="timecode mb-2 text-[0.65rem]">{group.label}</p>
          <div class="grid grid-cols-5 gap-2">
            {#each group.swatches as swatch (swatch)}
              <div>
                <div
                  class="border-border aspect-square rounded-lg border"
                  style:background={`var(--${swatch})`}>
                </div>
                <code class="text-dim mt-1 block truncate text-[0.6rem]"
                  >{swatch}</code>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet buttons()}
  <div class="flex flex-wrap items-center gap-3">
    {#each BUTTONS as button (button.label)}
      <button type="button" class={button.className} disabled={button.disabled}
        >{button.label}</button>
    {/each}
    <button type="button" class="btn-icon" aria-label={m.common_edit()}>
      <Icon name="edit" class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      class="btn-icon-bordered"
      aria-label={m.common_edit()}>
      <Icon name="edit" class="h-4 w-4" />
    </button>
  </div>
{/snippet}

{#snippet icons()}
  <div
    class="grid grid-cols-3 gap-px overflow-hidden rounded-lg sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
    {#each ICONS as icon (icon)}
      <div
        class="bg-surface-2 flex min-w-0 flex-col items-center gap-2 px-2 py-3">
        <Icon name={icon} class="text-accent h-5 w-5" />
        <code class="text-dim max-w-full truncate text-[0.6rem]">{icon}</code>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet badges()}
  <div class="flex flex-wrap items-center gap-3">
    <button type="button" class="chip">{m.admin_components_chip_idle()}</button>
    <button type="button" class="chip chip-on"
      >{m.admin_components_chip_selected()}</button>
    <NewBadge />
    <BetaBadge />
  </div>
{/snippet}

{#snippet fields()}
  <div class="grid gap-4 sm:grid-cols-3">
    <label class="space-y-1.5 text-sm font-semibold">
      {m.admin_components_field_default()}
      <input class="input mt-1.5" value={m.admin_components_field_value()} />
    </label>
    <label class="space-y-1.5 text-sm font-semibold">
      {m.admin_components_field_disabled()}
      <input
        class="input mt-1.5"
        value={m.admin_components_field_value()}
        disabled />
    </label>
    <label class="space-y-1.5 text-sm font-semibold">
      {m.admin_components_field_error()}
      <input
        class="input border-danger mt-1.5"
        aria-invalid="true"
        aria-describedby="catalogue-field-error" />
      <FieldError
        id="catalogue-field-error"
        message={m.admin_components_field_error_message()} />
    </label>
  </div>
{/snippet}

{#snippet passwordField()}
  <div class="max-w-md">
    <PasswordInput
      bind:value={password}
      ariaLabel={m.admin_components_password_label()} />
  </div>
{/snippet}

{#snippet controls()}
  <div class="flex flex-wrap items-center gap-5">
    <label class="flex items-center gap-3 text-sm font-semibold">
      <Switch
        checked={notificationsEnabled}
        onChange={(value) => (notificationsEnabled = value)}
        label={m.admin_components_switch_label()} />
      {m.admin_components_switch_label()}
    </label>
    <Switch
      checked={false}
      onChange={() => {}}
      disabled
      label={m.admin_components_switch_disabled()} />
    <SegmentedControl
      options={[
        { value: "compact", label: m.admin_components_segment_compact() },
        {
          value: "comfortable",
          label: m.admin_components_segment_comfortable(),
        },
      ]}
      value={viewMode}
      onChange={(value) => (viewMode = value)} />
  </div>
{/snippet}

{#snippet comboboxes()}
  <div class="flex flex-wrap gap-3">
    <Combobox
      label={m.admin_components_combobox_genre()}
      options={GENRE_OPTIONS}
      values={genres}
      searchable
      searchPlaceholder={m.admin_components_combobox_search()}
      onChange={(values) => (genres = values)} />
    <Combobox
      label={m.admin_components_combobox_sources()}
      options={SOURCE_OPTIONS}
      values={sources}
      multiselect
      onChange={(values) => (sources = values)} />
    <Combobox
      label={m.admin_components_field_disabled()}
      options={GENRE_OPTIONS}
      disabled
      onChange={() => {}} />
  </div>
{/snippet}

{#snippet wizard()}
  <div class="max-w-2xl">
    <Wizard
      steps={[
        { id: "select", label: m.admin_components_wizard_step_select() },
        { id: "review", label: m.admin_components_wizard_step_review() },
        { id: "finish", label: m.admin_components_wizard_step_finish() },
      ]}
      activeIndex={wizardStep}
      onBack={() => (wizardStep = Math.max(0, wizardStep - 1))}
      onNext={() => (wizardStep = Math.min(2, wizardStep + 1))}
      onFinish={() => (wizardStep = 0)}
      onJump={(index) => (wizardStep = index)}>
      <p class="text-dim text-sm">{m.admin_components_wizard_body()}</p>
    </Wizard>
  </div>
{/snippet}

{#snippet banners()}
  <div class="grid gap-3 sm:grid-cols-2">
    {#each BANNERS as banner (banner.variant)}
      <Banner variant={banner.variant}>{banner.message}</Banner>
    {/each}
  </div>
{/snippet}

{#snippet progressBars()}
  <div class="grid gap-4 sm:grid-cols-2">
    {#each PROGRESS as progress (progress.label)}
      <div>
        <div class="mb-1.5 flex justify-between gap-3 text-xs">
          <span>{progress.label}</span>
          <span class="timecode">{progress.value}%</span>
        </div>
        <ProgressBar value={progress.value} fillClass={progress.fillClass} />
      </div>
    {/each}
  </div>
{/snippet}

{#snippet emptyState()}
  <EmptyState class="py-9">
    <Icon name="library" class="text-accent mx-auto mb-3 h-7 w-7" />
    <p class="font-display font-bold">{m.admin_components_empty_title()}</p>
    <p class="mt-1 text-sm">{m.admin_components_empty_body()}</p>
  </EmptyState>
{/snippet}

{#snippet loadingState()}
  <div aria-label={m.common_loading()}><CardRowSkeleton count={2} /></div>
{/snippet}

{#snippet identity()}
  <div class="flex flex-wrap items-center gap-5">
    <div class="flex items-center gap-2">
      <Avatar seed="Alice" size={40} />
      <Avatar seed="Bastien" size={40} />
      <Avatar seed="Chloé" size={40} />
    </div>
    <span class="text-dim text-sm"
      ><RelativeTime iso={relativeDate} class="timecode" /></span>
  </div>
{/snippet}

{#snippet posters()}
  <div class="grid max-w-md grid-cols-2 gap-4 sm:grid-cols-3">
    {#each CAROUSEL_ITEMS.slice(0, 3) as title, index (title)}
      <div class="card">
        <Poster {title} adult={index === 2} />
        <p class="truncate p-3 text-sm font-semibold">{title}</p>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet posterCollections()}
  <div class="space-y-6">
    <PosterGrid>
      {#each CAROUSEL_ITEMS.slice(0, 4) as title, index (title)}
        <PosterCard
          href="#content"
          src={null}
          {title}
          favorite={index === 0}
          meta={posterMeta} />
      {/each}
    </PosterGrid>
    <PosterGridSkeleton count={5} />
  </div>
{/snippet}

{#snippet posterMeta()}
  <span class="text-dim text-xs">{m.admin_components_sample_meta()}</span>
{/snippet}

{#snippet providers()}
  <div class="flex flex-wrap gap-4">
    {#each PROVIDERS as provider (provider)}
      <span
        class="border-border bg-surface-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <ProviderMark brand={provider} />
        {provider}
      </span>
    {/each}
  </div>
{/snippet}

{#snippet ratings()}
  <div class="max-w-lg">
    <RatingPips value={rating} onChange={(value) => (rating = value)} />
  </div>
{/snippet}

{#snippet carousel()}
  <Carousel items={CAROUSEL_ITEMS} keyOf={(item) => item}>
    {#snippet card(title)}
      <div class="card w-32">
        <Poster {title} />
        <p class="truncate p-3 text-xs font-semibold">{title}</p>
      </div>
    {/snippet}
  </Carousel>
{/snippet}
