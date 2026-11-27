import { isDomainEnabled } from "#lib/work/domain-availability.js";
import type { HomeWidgetDto } from "@loomkeep/shared/contracts";
import type { Domain } from "@loomkeep/shared/enums";

/**
 * The domains a widget was set to show, still enabled — or null for "all of
 * them", which is also what a pick left empty by a disabled domain falls
 * back to.
 */
export function widgetDomains(widget: HomeWidgetDto): Domain[] | null {
  const picked = (widget.config?.domains ?? []).filter(isDomainEnabled);
  return picked.length > 0 ? picked : null;
}
