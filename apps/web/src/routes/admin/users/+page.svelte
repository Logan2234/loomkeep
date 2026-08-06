<script lang="ts">
  import { page } from "$app/state";
  import {
    ApiError,
    deleteAdminUser,
    getAdminUserComments,
    getAdminUserExport,
    getAdminUserFollowers,
    getAdminUserFollowing,
    getAdminUserLists,
    getAdminUserReportsAgainst,
    getAdminUserReviews,
    getAdminUsers,
    getAdminUserSessions,
    resendAdminUserVerification,
    revokeAdminUserSession,
    revokeAllAdminUserSessions,
    sendAdminUserPasswordReset,
    updateAdminUserRole,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AvatarLightbox from "$lib/components/AvatarLightbox.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { toast } from "$lib/toast.svelte";
  import type {
    AdminUserCommentDto,
    AdminUserDto,
    MyListDto,
    MyReviewDto,
    ReportDto,
    SessionDto,
    UserSummaryDto,
  } from "@loomkeep/shared";

  type Filter = "all" | "admin" | "unverified" | "never";

  const STATUS_LABELS: Record<ReportDto["status"], string> = {
    PENDING: "En attente",
    RESOLVED: "Résolu",
    DISMISSED: "Rejeté",
  };
  const STATUS_COLORS: Record<ReportDto["status"], string> = {
    PENDING: "border-accent/40 bg-accent/10 text-accent",
    RESOLVED: "border-success/40 bg-success/10 text-success",
    DISMISSED: "border-border bg-surface-2 text-dim",
  };

  let users = $state<AdminUserDto[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Pre-filled from `?q=` so links like /admin/users?q=<email> land pre-filtered
  // (used by the imports page's "Voir le compte →").
  let query = $state(page.url.searchParams.get("q") ?? "");
  let filter = $state<Filter>("all");

  const filteredUsers = $derived.by(() => {
    if (!users) return [];
    let list = users;
    if (filter === "admin") list = list.filter((u) => u.role === "ADMIN");
    else if (filter === "unverified")
      list = list.filter((u) => !u.emailVerified);
    else if (filter === "never") list = list.filter((u) => !u.lastActiveAt);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q),
    );
  });

  // --- drawer / detail state ---
  let selected = $state<AdminUserDto | null>(null);
  let sessions = $state<SessionDto[] | null>(null);
  let sessionsLoading = $state(false);
  let revoking = $state<string | null>(null);

  let showRevokeAllConfirm = $state(false);
  let revokingAll = $state(false);

  let roleSaving = $state(false);
  let roleError = $state("");

  let exporting = $state(false);
  let exportError = $state("");

  let verifySending = $state(false);
  let verifyMessage = $state("");
  let resetSending = $state(false);
  let resetMessage = $state("");

  let showDeleteModal = $state(false);
  let deleteConfirmText = $state("");
  let deleting = $state(false);
  let deleteError = $state("");

  // --- social activity shortcuts ---
  type ActivityKind =
    "reviews" | "comments" | "followers" | "following" | "lists" | "reports";
  let activityLoading = $state(false);
  let reviews = $state<MyReviewDto[]>([]);
  let comments = $state<AdminUserCommentDto[]>([]);
  let followers = $state<UserSummaryDto[]>([]);
  let following = $state<UserSummaryDto[]>([]);
  let lists = $state<MyListDto[]>([]);
  let reportsAgainst = $state<ReportDto[]>([]);
  let activeModal = $state<ActivityKind | null>(null);
  let avatarLightbox = $state(false);

  const ACTIVITY_SECTIONS: { kind: ActivityKind; label: string }[] = [
    { kind: "reviews", label: "Reviews" },
    { kind: "comments", label: "Commentaires" },
    { kind: "following", label: "Abonnements" },
    { kind: "followers", label: "Abonnés" },
    { kind: "lists", label: "Listes" },
    { kind: "reports", label: "Signalements reçus" },
  ];

  function activityCount(kind: ActivityKind): number {
    if (kind === "reviews") return reviews.length;
    if (kind === "comments") return comments.length;
    if (kind === "following") return following.length;
    if (kind === "followers") return followers.length;
    if (kind === "lists") return lists.length;
    return reportsAgainst.length;
  }

  async function load() {
    loading = true;
    error = null;
    try {
      users = await getAdminUsers();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Utilisateurs indisponibles";
    } finally {
      loading = false;
    }
  }

  async function openUser(user: AdminUserDto) {
    selected = user;
    sessions = null;
    sessionsLoading = true;
    verifyMessage = "";
    resetMessage = "";
    roleError = "";
    exportError = "";
    reviews = [];
    comments = [];
    followers = [];
    following = [];
    lists = [];
    reportsAgainst = [];
    activityLoading = true;
    try {
      sessions = await getAdminUserSessions(user.id);
    } catch {
      sessions = [];
    } finally {
      sessionsLoading = false;
    }
    try {
      const [r, c, fers, fing, l, rep] = await Promise.all([
        getAdminUserReviews(user.id).catch(() => []),
        getAdminUserComments(user.id).catch(() => []),
        getAdminUserFollowers(user.id).catch(() => []),
        getAdminUserFollowing(user.id).catch(() => []),
        getAdminUserLists(user.id).catch(() => []),
        getAdminUserReportsAgainst(user.id).catch(() => []),
      ]);
      reviews = r;
      comments = c;
      followers = fers;
      following = fing;
      lists = l;
      reportsAgainst = rep;
    } finally {
      activityLoading = false;
    }
  }

  function closeDrawer() {
    selected = null;
    activeModal = null;
    avatarLightbox = false;
  }

  async function revoke(sessionId: string) {
    if (!selected) return;
    revoking = sessionId;
    try {
      await revokeAdminUserSession(selected.id, sessionId);
      sessions = (sessions ?? []).filter((s) => s.id !== sessionId);
    } finally {
      revoking = null;
    }
  }

  async function confirmRevokeAll() {
    if (!selected) return;
    revokingAll = true;
    try {
      await revokeAllAdminUserSessions(selected.id);
      sessions = [];
      showRevokeAllConfirm = false;
    } finally {
      revokingAll = false;
    }
  }

  async function toggleAdmin(checked: boolean) {
    if (!selected) return;
    const next = checked ? "ADMIN" : "USER";

    roleSaving = true;
    roleError = "";
    try {
      const res = await updateAdminUserRole(selected.id, next);
      selected = { ...selected, role: res.role };
      users = (users ?? []).map((u) =>
        u.id === selected!.id ? { ...u, role: res.role } : u,
      );
    } catch (err) {
      roleError =
        err instanceof ApiError ? err.message : "Mise à jour impossible";
    } finally {
      roleSaving = false;
    }
  }

  async function downloadExport() {
    if (!selected) return;
    exporting = true;
    exportError = "";
    try {
      const data = await getAdminUserExport(selected.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loomkeep-export-${selected.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      exportError = err instanceof ApiError ? err.message : "Export impossible";
    } finally {
      exporting = false;
    }
  }

  async function resendVerification() {
    if (!selected) return;
    verifySending = true;
    verifyMessage = "";
    try {
      await resendAdminUserVerification(selected.id);
      verifyMessage = "Email de vérification renvoyé.";
      toast.success("Email de vérification renvoyé.");
    } catch (err) {
      verifyMessage =
        err instanceof ApiError ? err.message : "Échec de l'envoi";
    } finally {
      verifySending = false;
    }
  }

  async function sendPasswordReset() {
    if (!selected) return;
    resetSending = true;
    resetMessage = "";
    try {
      await sendAdminUserPasswordReset(selected.id);
      resetMessage = "Lien de réinitialisation envoyé.";
      toast.success("Lien de réinitialisation envoyé.");
    } catch (err) {
      resetMessage = err instanceof ApiError ? err.message : "Échec de l'envoi";
    } finally {
      resetSending = false;
    }
  }

  function openDeleteModal() {
    deleteConfirmText = "";
    deleteError = "";
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    if (deleting) return;
    showDeleteModal = false;
  }

  async function confirmDelete() {
    if (!selected || deleteConfirmText !== selected.username) return;
    deleting = true;
    deleteError = "";
    try {
      const deletedName = selected.displayName;
      await deleteAdminUser(selected.id);
      users = (users ?? []).filter((u) => u.id !== selected!.id);
      showDeleteModal = false;
      selected = null;
      toast.success(`Compte de ${deletedName} supprimé.`);
    } catch (err) {
      deleteError =
        err instanceof ApiError ? err.message : "Suppression impossible";
    } finally {
      deleting = false;
    }
  }

  $effect(() => {
    void load();
  });

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function activityLabel(u: AdminUserDto): string {
    return u.lastActiveAt
      ? dateTimeFmt.format(new Date(u.lastActiveAt))
      : "Jamais connecté";
  }

  function activityDotClass(u: AdminUserDto): string {
    if (!u.lastActiveAt) return "border border-dim";
    const hoursAgo =
      (Date.now() - new Date(u.lastActiveAt).getTime()) / 3_600_000;
    return hoursAgo < 1 ? "bg-success" : "bg-dim";
  }

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "admin", label: "Admin" },
    { value: "unverified", label: "Non vérifié" },
    { value: "never", label: "Jamais connecté" },
  ];
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && selected && !showDeleteModal) closeDrawer();
  }} />

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="user"
    title="Utilisateurs"
    subtitle="Comptes enregistrés, sessions et accès." />

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading}
    <div class="card h-64 animate-pulse"></div>
  {:else if users}
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="text"
        bind:value={query}
        placeholder="Filtrer par email, identifiant ou nom…"
        class="border-border bg-surface w-full max-w-xs rounded-lg border px-3 py-2 text-sm" />
      <Combobox
        label="Filtrer"
        options={FILTERS}
        values={[filter]}
        onChange={(v) => (filter = (v[0] as Filter) ?? "all")} />
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr
            class="border-border text-dim border-b text-left text-xs font-semibold uppercase">
            <th class="px-4 py-2.5">Compte</th>
            <th class="hidden px-4 py-2.5 sm:table-cell">Actif</th>
            <th class="hidden px-4 py-2.5 md:table-cell">Créé</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredUsers as u (u.id)}
            <tr
              onclick={() => openUser(u)}
              class="border-border hover:bg-surface-2 cursor-pointer border-b transition-colors last:border-b-0 {selected?.id ===
              u.id
                ? 'bg-accent/10'
                : ''}">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <Avatar seed={u.username} size={36} />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-fg truncate font-semibold"
                        >{u.displayName}</span>
                      {#if u.role === "ADMIN"}
                        <span
                          class="border-accent/40 bg-accent/10 text-accent rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                          Admin
                        </span>
                      {/if}
                      {#if !u.emailVerified}
                        <span
                          class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                          Non vérifié
                        </span>
                      {/if}
                    </div>
                    <p class="text-dim truncate text-xs">{u.email}</p>
                  </div>
                </div>
              </td>
              <td class="hidden px-4 py-3 sm:table-cell">
                <div class="text-dim flex items-center gap-2 text-xs">
                  <span
                    class="h-1.5 w-1.5 shrink-0 rounded-full {activityDotClass(
                      u,
                    )}"></span>
                  {activityLabel(u)}
                </div>
              </td>
              <td class="text-dim hidden px-4 py-3 text-xs md:table-cell">
                {dateFmt.format(new Date(u.createdAt))}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if users.length === 0}
        <p class="text-dim px-4 py-6 text-center text-sm">
          Aucun compte enregistré.
        </p>
      {:else if filteredUsers.length === 0}
        <p class="text-dim px-4 py-6 text-center text-sm">
          Aucun compte ne correspond à ce filtre.
        </p>
      {/if}
    </div>
  {/if}
</div>

{#if selected}
  <div class="fixed inset-0 z-50 flex justify-end">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label="Fermer"
      onclick={closeDrawer}></button>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      class="card relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto rounded-none border-y-0 border-r-0 p-5">
      <div class="mb-4 flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Voir l'avatar en grand"
            onclick={() => (avatarLightbox = true)}
            class="cursor-zoom-in">
            <Avatar seed={selected.username} size={48} />
          </button>
          <div class="min-w-0">
            <h2
              id="drawer-title"
              class="font-display truncate text-lg font-bold">
              {selected.displayName}
            </h2>
            <p class="text-dim truncate text-xs">
              @{selected.username} · {selected.email}
            </p>
            <a
              href="/u/{selected.username}"
              class="text-accent mt-0.5 inline-block text-xs hover:underline">
              Voir le profil public →
            </a>
          </div>
        </div>
        <button
          class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-full p-1.5"
          aria-label="Fermer"
          onclick={closeDrawer}>
          <Icon name="x" class="h-5 w-5" />
        </button>
      </div>

      {#if avatarLightbox}
        <AvatarLightbox
          seed={selected.username}
          onClose={() => (avatarLightbox = false)} />
      {/if}

      <!-- Identité -->
      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          Identité
          <span class="bg-border h-px flex-1"></span>
        </h3>
        <label
          class="border-border flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
          for="role-admin">
          <span class="text-fg font-semibold">Administrateur</span>
          <input
            id="role-admin"
            type="checkbox"
            class="accent-accent h-4 w-4 shrink-0"
            checked={selected.role === "ADMIN"}
            disabled={roleSaving ||
              (selected.id === auth.user?.id && selected.role === "ADMIN")}
            onchange={(e) => toggleAdmin(e.currentTarget.checked)} />
        </label>
        {#if selected.id === auth.user?.id && selected.role === "ADMIN"}
          <p class="text-dim mt-1.5 text-xs">
            Tu ne peux pas retirer ton propre accès admin.
          </p>
        {/if}
        {#if roleError}
          <p class="text-danger mt-1.5 text-xs">{roleError}</p>
        {/if}
      </section>

      <!-- Accès -->
      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          Accès
          <span class="bg-border h-px flex-1"></span>
        </h3>
        {#if sessionsLoading}
          <div class="space-y-2">
            {#each { length: 2 } as _, i (i)}
              <div class="skeleton h-12 rounded-lg"></div>
            {/each}
          </div>
        {:else if sessions && sessions.length > 0}
          <ul class="mb-2 space-y-2">
            {#each sessions as s (s.id)}
              <li
                class="border-border flex items-center gap-2 rounded-lg border px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="text-fg truncate text-xs font-semibold">
                    {s.userAgent ?? "Appareil inconnu"}
                  </p>
                  <p class="text-dim text-[0.65rem]">
                    Actif {dateTimeFmt.format(new Date(s.lastUsedAt))}
                  </p>
                </div>
                <button
                  onclick={() => revoke(s.id)}
                  disabled={revoking === s.id}
                  aria-label="Révoquer cette session"
                  class="text-dim hover:bg-danger/10 hover:text-danger shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50">
                  <Icon name="trash" class="h-4 w-4" />
                </button>
              </li>
            {/each}
          </ul>
          {#if sessions.length > 1}
            <button
              class="btn btn-danger btn-sm w-full"
              onclick={() => (showRevokeAllConfirm = true)}>
              Révoquer toutes les sessions
            </button>
          {/if}
        {:else}
          <p class="text-dim text-sm">Aucune session active.</p>
        {/if}
      </section>

      <!-- Activité sociale -->
      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          Activité sociale
          <span class="bg-border h-px flex-1"></span>
        </h3>
        {#if activityLoading}
          <div class="skeleton h-24 rounded-lg"></div>
        {:else}
          <ul
            class="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {#each ACTIVITY_SECTIONS as s (s.kind)}
              <li>
                <button
                  type="button"
                  disabled={activityCount(s.kind) === 0}
                  onclick={() => (activeModal = s.kind)}
                  class="hover:bg-surface-2 flex w-full items-center justify-between px-3 py-2 text-left text-sm disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent">
                  <span class="text-fg">{s.label}</span>
                  <span class="text-dim text-xs font-semibold"
                    >{activityCount(s.kind)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Données -->
      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          Données
          <span class="bg-border h-px flex-1"></span>
        </h3>
        <div class="flex gap-2">
          <button
            onclick={downloadExport}
            disabled={exporting}
            class="btn btn-ghost btn-sm flex-1 disabled:opacity-50">
            <Icon name="download" class="mr-1 inline h-3.5 w-3.5" />
            Exporter
          </button>
          <a
            href="/admin/communications?tab=push&email={encodeURIComponent(
              selected.email,
            )}"
            class="btn btn-ghost btn-sm flex-1 text-center">
            <Icon name="bell" class="mr-1 inline h-3.5 w-3.5" />
            Push test
          </a>
        </div>
        {#if exportError}
          <p class="text-danger mt-1.5 text-xs">{exportError}</p>
        {/if}
      </section>

      <!-- Zone sensible -->
      <section
        class="border-danger/40 bg-danger/5 mt-auto rounded-xl border p-3">
        <h3
          class="text-danger mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          Zone sensible
          <span class="bg-danger/40 h-px flex-1"></span>
        </h3>
        <div class="flex flex-col gap-2">
          <button
            onclick={resendVerification}
            disabled={verifySending || selected.emailVerified}
            class="btn btn-ghost btn-sm w-full disabled:opacity-50">
            {verifySending ? "Envoi…" : "Renvoyer l'email de vérification"}
          </button>
          <button
            onclick={sendPasswordReset}
            disabled={resetSending}
            class="btn btn-ghost btn-sm w-full disabled:opacity-50">
            {resetSending ? "Envoi…" : "Envoyer un lien de réinitialisation"}
          </button>
          {#if verifyMessage}
            <p class="text-dim text-xs">{verifyMessage}</p>
          {/if}
          {#if resetMessage}
            <p class="text-dim text-xs">{resetMessage}</p>
          {/if}
          {#if selected.id === auth.user?.id}
            <p class="text-dim text-xs">
              Utilise la suppression de compte depuis /settings pour ton propre
              compte.
            </p>
          {:else}
            <button
              onclick={openDeleteModal}
              class="btn btn-danger btn-sm w-full">
              Supprimer le compte
            </button>
          {/if}
        </div>
      </section>
    </div>
  </div>
{/if}

{#if activeModal === "reviews"}
  <Modal title="Reviews" onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each reviews as r (r.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          {#if r.target?.href}
            <a href={r.target.href} class="font-semibold hover:underline"
              >{r.target.title}</a>
          {:else}
            <span class="font-semibold"
              >{r.target?.title ?? "Œuvre supprimée"}</span>
          {/if}
          <span class="text-dim ml-2 text-xs">{r.rating}/10</span>
          {#if r.text}
            <p class="text-dim mt-1 line-clamp-2 text-xs">{r.text}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "comments"}
  <Modal title="Commentaires" onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each comments as c (c.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          {#if c.href}
            <a href={c.href} class="hover:underline">{c.excerpt}</a>
          {:else}
            <p>{c.excerpt}</p>
          {/if}
          <p class="text-dim mt-1 text-xs">
            {dateFmt.format(new Date(c.createdAt))}
          </p>
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "followers" || activeModal === "following"}
  <Modal
    title={activeModal === "followers" ? "Abonnés" : "Abonnements"}
    onclose={() => (activeModal = null)}>
    <ul class="space-y-1">
      {#each activeModal === "followers" ? followers : following as u (u.id)}
        <li>
          <a
            href="/u/{u.username}"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar seed={u.username} size={36} />
            <span class="min-w-0">
              <span class="text-fg block truncate text-sm font-semibold"
                >{u.displayName}</span>
              <span class="text-dim block truncate text-xs">@{u.username}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "lists"}
  <Modal title="Listes" onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each lists as l (l.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-fg font-semibold">{l.title}</span>
            <span class="text-dim text-xs">· {l.itemCount} élément(s)</span>
          </div>
          <p class="text-dim mt-0.5 text-xs">
            {l.kind} · {l.visibility}
          </p>
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "reports"}
  <Modal title="Signalements reçus" onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each reportsAgainst as r (r.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          <div class="flex items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {STATUS_COLORS[
                r.status
              ]}">{STATUS_LABELS[r.status]}</span>
            <span class="text-dim ml-auto text-xs"
              >{dateFmt.format(new Date(r.createdAt))}</span>
          </div>
          {#if r.target}
            {#if r.target.href}
              <a href={r.target.href} class="mt-1.5 block hover:underline"
                >{r.target.label}</a>
            {:else}
              <p class="mt-1.5">{r.target.label}</p>
            {/if}
          {/if}
          {#if r.reason}
            <p class="text-dim mt-1 text-xs">« {r.reason} »</p>
          {/if}
        </li>
      {/each}
    </ul>
  </Modal>
{/if}

{#if showRevokeAllConfirm && selected}
  <ConfirmationModal
    title="Révoquer toutes les sessions ?"
    message={`Tous les appareils connectés de ${selected.displayName} seront déconnectés. Le compte devra se reconnecter partout.`}
    confirmLabel="Révoquer tout"
    danger
    busy={revokingAll}
    onConfirm={confirmRevokeAll}
    onCancel={() => (showRevokeAllConfirm = false)} />
{/if}

{#if showDeleteModal && selected}
  <div
    class="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label="Fermer"
      onclick={closeDeleteModal}></button>
    <div
      role="dialog"
      aria-modal="true"
      class="card relative z-10 w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
      <h3 class="font-display text-danger mb-3 text-lg font-bold">
        Supprimer le compte
      </h3>
      <p class="text-dim text-sm">
        Le compte de <strong class="text-fg">{selected.displayName}</strong> et toutes
        ses données (bibliothèques, historique, notifications) seront définitivement
        supprimés. Cette action est irréversible.
      </p>
      <p class="text-dim mt-3 text-sm">
        Pour confirmer, tape
        <code
          class="bg-surface-2 text-fg rounded px-1.5 py-0.5 text-xs font-bold"
          >{selected.username}</code>
        ci-dessous.
      </p>
      <input
        type="text"
        bind:value={deleteConfirmText}
        disabled={deleting}
        placeholder={selected.username}
        class="border-border bg-surface mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
      {#if deleteError}
        <Banner variant="error" class="mt-3">{deleteError}</Banner>
      {/if}
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={deleting}
          onclick={closeDeleteModal}>
          Annuler
        </button>
        <button
          type="button"
          class="btn btn-danger"
          disabled={deleting || deleteConfirmText !== selected.username}
          onclick={confirmDelete}>
          {deleting ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>
    </div>
  </div>
{/if}
