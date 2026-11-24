import type { Prisma, UserPreferences } from "@prisma/client";

/** UserPreferences' column defaults, as the schema declares them. */
export const PREFERENCE_DEFAULTS: Omit<UserPreferences, "userId"> = {
  allowAdultContent: false,
  hideProgression: false,
  chatShowPresence: true,
  chatShowReadReceipts: true,
  chatShareWatchProviders: false,
  feedbackWidget: true,
  notifyEmail: "WEEKLY",
  notifyPush: "WEEKLY",
  alertPrefs: {},
  notifyNewsletter: false,
  defaultReviewVisibility: "FRIENDS",
  defaultListVisibility: "PRIVATE",
  spoilerSensitivity: "AUTO",
  domainOrder: [],
  watchRegion: null,
  watchProviderIds: [],
  listenServices: [],
  homeLayout: null,
  homePhoneLayout: null,
};

/**
 * An account's preferences, the defaults filling in a missing row (every
 * account gets one at sign-up and from the migration, so this is a guard,
 * not a path the app relies on).
 */
export function preferencesOf<T extends Partial<UserPreferences>>(
  row: T | null | undefined,
): Omit<UserPreferences, "userId"> & T {
  return { ...PREFERENCE_DEFAULTS, ...(row ?? {}) } as Omit<
    UserPreferences,
    "userId"
  > &
    T;
}

/** A nested write that sets preferences whether or not the row exists yet. */
export function upsertPreferences(
  data: Prisma.UserPreferencesUpdateWithoutUserInput &
    Prisma.UserPreferencesCreateWithoutUserInput,
): Prisma.UserPreferencesUpdateOneWithoutUserNestedInput {
  return { upsert: { create: data, update: data } };
}
