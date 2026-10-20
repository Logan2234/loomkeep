import { DOCS_URL } from "#lib/constants/external-links.js";
import { m } from "#lib/paraglide/messages.js";
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

/** The docs recipe closest to each preset. */
export const RECIPE_GUIDES: Record<Recipe["id"], string> = {
  backup: `${DOCS_URL}/api/recipes/backup/`,
  releases: `${DOCS_URL}/api/recipes/home-assistant/`,
  script: `${DOCS_URL}/api/recipes/weekly-digest/`,
};
