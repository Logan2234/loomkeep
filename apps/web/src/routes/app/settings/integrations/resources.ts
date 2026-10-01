import { m } from "$lib/paraglide/messages.js";
import type { ApiKeyResource, ApiKeyScope } from "@loomkeep/shared";

export const RESOURCE_LABELS: Record<
  ApiKeyResource,
  { label: () => string; description: () => string }
> = {
  library: {
    label: m.common_library,
    description: m.settings_api_keys_resource_library_desc,
  },
  lists: {
    label: m.common_lists,
    description: m.settings_api_keys_resource_lists_desc,
  },
  calendar: {
    label: m.common_calendar,
    description: m.settings_api_keys_resource_calendar_desc,
  },
  stats: {
    label: m.settings_api_keys_resource_stats,
    description: m.settings_api_keys_resource_stats_desc,
  },
  reviews: {
    label: m.settings_api_keys_resource_reviews,
    description: m.settings_api_keys_resource_reviews_desc,
  },
  profile: {
    label: m.settings_api_keys_resource_profile,
    description: m.settings_api_keys_resource_profile_desc,
  },
  notifications: {
    label: m.common_notifications,
    description: m.settings_api_keys_resource_notifications_desc,
  },
  export: {
    label: m.settings_api_keys_resource_export,
    description: m.settings_api_keys_resource_export_desc,
  },
};

function scopeResource(scope: ApiKeyScope): ApiKeyResource {
  return scope.split(":")[0] as ApiKeyResource;
}

export function scopeLabels(scopes: ApiKeyScope[]): string[] {
  return scopes.map((scope) => RESOURCE_LABELS[scopeResource(scope)].label());
}
