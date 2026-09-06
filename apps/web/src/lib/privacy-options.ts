import { m } from "$lib/paraglide/messages.js";
import {
  ProfileAccess,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared";

export const ACCESS: { id: ProfileAccess; label: string; desc: string }[] = [
  {
    id: ProfileAccess.PUBLIC,
    label: m.common_public(),
    desc: m.settings_privacy_public_desc(),
  },
  {
    id: ProfileAccess.PRIVATE,
    label: m.common_private(),
    desc: m.settings_privacy_private_desc(),
  },
  {
    id: ProfileAccess.GHOST,
    label: m.profile_ghost(),
    desc: m.settings_privacy_ghost_desc(),
  },
];

export const ACCESS_OPTIONS = ACCESS.map((a) => ({ id: a.id, label: a.label }));

export const FACETS: { id: VisibilityFacet; label: string }[] = [
  { id: VisibilityFacet.LIBRARY, label: m.common_library() },
  { id: VisibilityFacet.ACTIVITY, label: m.common_activity() },
];

export const AUDIENCES: { id: VisibilityAudience; label: string }[] = [
  { id: VisibilityAudience.PUBLIC, label: m.common_public() },
  { id: VisibilityAudience.FRIENDS, label: m.common_friends() },
  { id: VisibilityAudience.NONE, label: m.settings_privacy_nobody() },
];

export const MODE_MATRIX: {
  action: string;
  public: string;
  private: string;
  ghost: string;
}[] = [
  {
    action: m.settings_privacy_searchable(),
    public: "✓",
    private: "✓",
    ghost: "✗",
  },
  {
    action: m.settings_privacy_profile_viewable(),
    public: "✓",
    private: m.common_friends(),
    ghost: "✗",
  },
  {
    action: m.settings_privacy_can_follow(),
    public: m.settings_privacy_freely(),
    private: m.settings_privacy_on_request(),
    ghost: "✗",
  },
  {
    action: m.settings_privacy_can_initiate_follow(),
    public: "✓",
    private: "✓",
    ghost: m.settings_privacy_public_profiles(),
  },
  {
    action: m.settings_privacy_befriend(),
    public: "✓",
    private: "✓",
    ghost: "✗",
  },
  {
    action: m.settings_privacy_view_content(),
    public: "✓ / ✓",
    private: "✓ / ✓",
    ghost: "✓ / ✗",
  },
  {
    action: m.settings_privacy_comment_react(),
    public: "✓",
    private: "✓",
    ghost: m.settings_privacy_anonymous(),
  },
  {
    action: m.settings_privacy_publish_reviews(),
    public: "✓",
    private: "✓",
    ghost: m.settings_privacy_excluded_rating(),
  },
  {
    action: m.settings_privacy_appear_feed(),
    public: "✓",
    private: m.common_friends(),
    ghost: "✗",
  },
  {
    action: m.settings_privacy_mention_name(),
    public: "✓",
    private: m.settings_privacy_locked(),
    ghost: "✗",
  },
];
