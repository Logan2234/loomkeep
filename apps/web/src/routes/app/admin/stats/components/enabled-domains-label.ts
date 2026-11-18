import { m } from "#lib/paraglide/messages.js";

// Accounts that haven't finished onboarding have no domain yet.
export function enabledDomainsLabel(domains: number): string {
  if (domains === 0) return m.admin_accounts_domains_none();
  return domains > 1
    ? m.admin_accounts_domains_many({ count: domains })
    : m.admin_accounts_domain_one();
}
