import { m } from "$lib/paraglide/messages.js";
import type { Recipe } from "./api-key-form";

export const RECIPE_LABELS: Record<
  Recipe["id"],
  { name: () => string; description: () => string }
> = {
  backup: {
    name: m.settings_api_keys_recipe_backup_name,
    description: m.settings_api_keys_recipe_backup_desc,
  },
  releases: {
    name: m.settings_api_keys_recipe_releases_name,
    description: m.settings_api_keys_recipe_releases_desc,
  },
  script: {
    name: m.settings_api_keys_recipe_script_name,
    description: m.settings_api_keys_recipe_script_desc,
  },
};
