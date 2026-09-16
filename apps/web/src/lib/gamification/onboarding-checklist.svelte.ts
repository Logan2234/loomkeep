// Shared by OnboardingWidget (desktop), OnboardingBanner (mobile) and
// MobileLayout (just needs the boolean to reserve layout space) — all three
// used to run their own identical createApiQuery, each with its own 30s
// poll. Centralized here now that a live push exists, so the listener only
// needs registering once per call site instead of tripling the same wiring.
import { useQueryClient } from "@tanstack/svelte-query";
import { getOnboardingChecklist } from "../api/gamification";
import { keys } from "../api/keys";
import { createApiQuery } from "../api/query.svelte";
import { onRealtimeEvent } from "../realtime/socket";

export function useOnboardingChecklist() {
  const queryClient = useQueryClient();
  const query = createApiQuery(() => ({
    key: keys.gamification.onboarding(),
    fetch: getOnboardingChecklist,
  }));

  // Pushed live by EventsGateway (see OnboardingService's own steps: adding/
  // completing a title, rating, importing, creating a list, commenting,
  // completing the profile) instead of the 30s poll this used to run.
  $effect(() =>
    onRealtimeEvent("onboarding-updated", () => {
      void queryClient.invalidateQueries({
        queryKey: keys.gamification.onboarding(),
      });
    }),
  );

  return query;
}
