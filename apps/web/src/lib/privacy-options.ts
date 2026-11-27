import { m } from "#lib/paraglide/messages.js";
import {
  type Domain,
  ProfileAccess,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared/enums";

export const ACCESS: { id: ProfileAccess; label: string; desc: string }[] = [
  {
    id: ProfileAccess.PUBLIC,
    get label() {
      return m.common_public();
    },
    get desc() {
      return m.settings_privacy_public_desc();
    },
  },
  {
    id: ProfileAccess.PRIVATE,
    get label() {
      return m.common_private();
    },
    get desc() {
      return m.settings_privacy_private_desc();
    },
  },
  {
    id: ProfileAccess.GHOST,
    get label() {
      return m.profile_ghost();
    },
    get desc() {
      return m.settings_privacy_ghost_desc();
    },
  },
];

export const ACCESS_OPTIONS = ACCESS.map((a) => ({
  id: a.id,
  get label() {
    return a.label;
  },
}));

export const FACETS: { id: VisibilityFacet; label: string }[] = [
  {
    id: VisibilityFacet.LIBRARY,
    get label() {
      return m.common_library();
    },
  },
  {
    id: VisibilityFacet.ACTIVITY,
    get label() {
      return m.common_activity();
    },
  },
];

export const AUDIENCES: { id: VisibilityAudience; label: string }[] = [
  {
    id: VisibilityAudience.PUBLIC,
    get label() {
      return m.common_public();
    },
  },
  {
    id: VisibilityAudience.FRIENDS,
    get label() {
      return m.common_friends();
    },
  },
  {
    id: VisibilityAudience.NONE,
    get label() {
      return m.settings_privacy_nobody();
    },
  },
];

export const MODE_MATRIX: {
  action: string;
  public: string;
  private: string;
  ghost: string;
}[] = [
  {
    get action() {
      return m.settings_privacy_searchable();
    },
    public: "✓",
    private: "✓",
    ghost: "✗",
  },
  {
    get action() {
      return m.settings_privacy_profile_viewable();
    },
    public: "✓",
    get private() {
      return m.common_friends();
    },
    ghost: "✗",
  },
  {
    get action() {
      return m.settings_privacy_can_follow();
    },
    get public() {
      return m.settings_privacy_freely();
    },
    get private() {
      return m.settings_privacy_on_request();
    },
    ghost: "✗",
  },
  {
    get action() {
      return m.settings_privacy_can_initiate_follow();
    },
    public: "✓",
    private: "✓",
    get ghost() {
      return m.settings_privacy_public_profiles();
    },
  },
  {
    get action() {
      return m.settings_privacy_befriend();
    },
    public: "✓",
    private: "✓",
    ghost: "✗",
  },
  {
    get action() {
      return m.settings_privacy_view_content();
    },
    public: "✓ / ✓",
    private: "✓ / ✓",
    ghost: "✓ / ✗",
  },
  {
    get action() {
      return m.settings_privacy_comment_react();
    },
    public: "✓",
    private: "✓",
    get ghost() {
      return m.settings_privacy_anonymous();
    },
  },
  {
    get action() {
      return m.settings_privacy_publish_reviews();
    },
    public: "✓",
    private: "✓",
    get ghost() {
      return m.settings_privacy_excluded_rating();
    },
  },
  {
    get action() {
      return m.settings_privacy_appear_feed();
    },
    public: "✓",
    get private() {
      return m.common_friends();
    },
    ghost: "✗",
  },
  {
    get action() {
      return m.settings_privacy_mention_name();
    },
    public: "✓",
    get private() {
      return m.settings_privacy_locked();
    },
    ghost: "✗",
  },
];

/** The audience every given domain shares for a facet, or null when they differ. */
export function commonAudience(
  audienceOf: (domain: Domain, facet: VisibilityFacet) => VisibilityAudience,
  domains: Domain[],
  facet: VisibilityFacet,
): VisibilityAudience | null {
  const audiences = new Set(domains.map((d) => audienceOf(d, facet)));
  return audiences.size === 1 ? [...audiences][0] : null;
}
