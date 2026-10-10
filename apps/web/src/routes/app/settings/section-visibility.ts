import { appConfig } from "#lib/config.svelte.js";
import { isDomainEnabled } from "#lib/domains.js";
import type { SettingsSectionDef } from "./nav";

/**
 * Whether a settings section shows — in the rail, the search and the
 * shortcuts alike, so Alt+N keeps the same numbers everywhere: not without
 * social for a social one, nor with its domain turned off.
 */
export function isSectionVisible(section: SettingsSectionDef): boolean {
  return (
    (!section.social || appConfig.socialEnabled) &&
    (!section.domain || isDomainEnabled(section.domain))
  );
}
