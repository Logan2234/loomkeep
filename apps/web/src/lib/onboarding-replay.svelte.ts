/**
 * "Revoir l'accueil" (Settings › Help): shows the first-run wizard again to
 * someone already onboarded. Client state only, so a reload ends the replay.
 */
export const onboardingReplay = $state({ active: false });
