import {
  DOMAIN_SETTING,
  type DomainSettingKey,
  type InstanceDomain,
} from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";
import type { ConfigService } from "@nestjs/config";
import { instanceSetting } from "./instance-settings.store";

// Books (Open Library) and music (MusicBrainz) need no key.
const DOMAIN_ENV: Record<InstanceDomain, string[]> = {
  [Domain.MEDIA]: ["TMDB_API_TOKEN"],
  [Domain.GAMES]: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
  [Domain.BOOKS]: [],
  [Domain.MUSIC]: [],
};

export const INSTANCE_DOMAINS = Object.keys(DOMAIN_SETTING) as InstanceDomain[];

/** The catalogue env vars `domain` needs and this instance lacks. */
export function missingDomainEnv(
  config: ConfigService,
  domain: InstanceDomain,
): string[] {
  return DOMAIN_ENV[domain].filter((key) => !config.get<string>(key));
}

function isInstanceDomain(domain: Domain): domain is InstanceDomain {
  return domain in DOMAIN_SETTING;
}

/**
 * The domains the instance offers: turned on, catalogue key set. The "coming
 * soon" placeholders have no switch and stay offered. `values` lets a
 * pending admin change be checked before it is saved.
 */
export function instanceDomains(
  config: ConfigService,
  values?: Record<DomainSettingKey, boolean>,
): Domain[] {
  return Object.values(Domain).filter((domain) => {
    if (!isInstanceDomain(domain)) return true;
    const key = DOMAIN_SETTING[domain];
    return (
      (values?.[key] ?? instanceSetting(config, key)) &&
      missingDomainEnv(config, domain).length === 0
    );
  });
}

export function isDomainOffered(
  config: ConfigService,
  domain: Domain,
): boolean {
  return instanceDomains(config).includes(domain);
}
