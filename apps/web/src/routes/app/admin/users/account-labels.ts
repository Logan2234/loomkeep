import { m } from "#lib/paraglide/messages.js";
import {
  DigestCadence,
  ModerationMeasure,
  ProfileAccess,
  PushPlatform,
  ReviewVisibility,
} from "@loomkeep/shared";

export const CADENCE_LABELS: Record<DigestCadence, () => string> = {
  [DigestCadence.DISABLED]: () => m.settings_communications_cadence_disabled(),
  [DigestCadence.WEEKLY]: () => m.settings_communications_cadence_weekly(),
  [DigestCadence.DAILY]: () => m.settings_communications_cadence_daily(),
};

export const PROFILE_ACCESS_LABELS: Record<ProfileAccess, () => string> = {
  [ProfileAccess.PUBLIC]: () => m.common_public(),
  [ProfileAccess.PRIVATE]: () => m.common_private(),
  [ProfileAccess.GHOST]: () => m.admin_user_profile_ghost(),
};

export const REVIEW_VISIBILITY_LABELS: Record<ReviewVisibility, () => string> =
  {
    [ReviewVisibility.FRIENDS]: () => m.common_friends(),
    [ReviewVisibility.PUBLIC]: () => m.common_public(),
  };

export const PUSH_PLATFORM_LABELS: Record<PushPlatform, () => string> = {
  [PushPlatform.WEB]: () => m.admin_user_push_web(),
  [PushPlatform.ANDROID]: () => m.admin_user_push_android(),
};

export const MEASURE_LABELS: Record<ModerationMeasure, () => string> = {
  [ModerationMeasure.COMMENT_REMOVED]: () => m.admin_user_measure_comment(),
  [ModerationMeasure.MESSAGE_REMOVED]: () => m.admin_user_measure_message(),
  [ModerationMeasure.REVIEW_REMOVED]: () => m.admin_user_measure_review(),
  [ModerationMeasure.LIST_REMOVED]: () => m.admin_user_measure_list_removed(),
  [ModerationMeasure.LIST_EDITED]: () => m.admin_user_measure_list_edited(),
  [ModerationMeasure.AVATAR_REMOVED]: () => m.admin_user_measure_avatar(),
  [ModerationMeasure.BIO_CLEARED]: () => m.admin_user_measure_bio(),
  [ModerationMeasure.DISPLAY_NAME_CHANGED]: () => m.admin_user_measure_name(),
  [ModerationMeasure.ACCOUNT_SUSPENDED]: () => m.admin_user_measure_suspended(),
  [ModerationMeasure.ACCOUNT_DELETED]: () => m.admin_user_measure_deleted(),
};
