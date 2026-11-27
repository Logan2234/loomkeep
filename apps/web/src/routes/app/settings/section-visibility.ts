import { appConfig } from "#lib/shell/config.svelte.js";
import { isDomainEnabled } from "#lib/work/domain-availability.js";
import type { SettingsSectionDef } from "./nav";

/**
 * Whether a settings section shows — in the rail, the search and the
 * shortcuts alike, so Alt+N keeps the same numbers everywhere: not without
 * social for a social one, nor with all of its domains turned off.
 */
export function isSectionVisible(section: SettingsSectionDef): boolean {
  return (
    (!section.social || appConfig.socialEnabled) &&
    (!section.domains || section.domains.some(isDomainEnabled))
  );
}
