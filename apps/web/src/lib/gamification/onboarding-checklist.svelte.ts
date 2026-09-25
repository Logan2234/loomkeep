// Shared by OnboardingWidget (desktop), OnboardingBanner (mobile) and
// MobileLayout. Centralizing the live query avoids duplicate listeners.
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

  // EventsGateway pushes every action that can change checklist progress.
  $effect(() =>
    onRealtimeEvent("onboarding-updated", () => {
      void queryClient.invalidateQueries({
        queryKey: keys.gamification.onboarding(),
      });
    }),
  );

  return query;
}
