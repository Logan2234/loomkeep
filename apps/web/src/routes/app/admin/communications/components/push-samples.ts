import { m } from "#lib/paraglide/messages.js";
import {
  ALERTS,
  AlertGroup,
  type AlertKey,
  PUSH_SAMPLE_KEYS,
} from "@loomkeep/shared";

// Settings › Communications names each alert the same way.
const LABELS: Partial<Record<AlertKey, () => string>> = {
  CHAT_MESSAGE: m.settings_alert_chat_message,
  COMMENT_REPLY: m.settings_alert_comment_reply,
  COMMENT_MENTION: m.settings_alert_comment_mention,
  COMMENT_REACTIONS: m.settings_alert_comment_reactions,
  REVIEW_VOTES: m.settings_alert_review_votes,
  FOLLOW_REQUEST: m.settings_alert_follow_request,
  FOLLOW: m.settings_alert_follow,
  FOLLOW_ACCEPTED: m.settings_alert_follow_accepted,
  LIST_MEMBER_ADDED: m.settings_alert_list_member_added,
  LIST_ITEM_ADDED: m.settings_alert_list_item_added,
  INVITATION_ACCEPTED: m.settings_alert_invitation_accepted,
  IMPORT_FINISHED: m.settings_alert_import_finished,
  NEW_EPISODE: m.settings_communications_releases_title,
  SAGA_SEQUEL_ANNOUNCED: m.settings_alert_saga_sequel,
  PAUSED_REMINDER: m.settings_alert_paused_reminder,
  ADMIN_REPORTS_PENDING: m.settings_alert_admin_reports_pending,
  ADMIN_JOB_FAILED: m.settings_alert_admin_job_failed,
  ADMIN_QUOTA: m.settings_alert_admin_quota,
  ADMIN_NEW_USER: m.settings_alert_admin_new_user,
  ADMIN_UPDATE_AVAILABLE: m.settings_alert_admin_update_available,
};

const GROUPS: Record<AlertGroup, () => string> = {
  [AlertGroup.ACTIVITY]: m.common_activity,
  [AlertGroup.RELEASES]: m.push_channel_releases,
  [AlertGroup.ACCOUNT]: m.common_account,
  [AlertGroup.SECURITY]: m.common_security,
  [AlertGroup.ADMIN]: m.common_admin,
  [AlertGroup.ANNOUNCEMENTS]: m.push_channel_announcements,
};

/** The alerts whose push the admin can send a sample of, labelled and grouped. */
export function pushSampleOptions(): {
  value: AlertKey;
  label: string;
  group: string;
}[] {
  return PUSH_SAMPLE_KEYS.map((key) => ({
    value: key,
    label: LABELS[key]?.() ?? key,
    group: GROUPS[ALERTS[key].group](),
  }));
}
