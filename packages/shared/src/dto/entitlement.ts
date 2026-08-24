/**
 * The current user's real plan (`UserEntitlement.plan`), from `GET
 * /users/me/entitlement`. Not the "effective" premium status — the web
 * combines this with the `premium-features` Unleash flag itself to decide
 * what to lock, same as the API does internally (see
 * `EntitlementService#isEffectivelyPremium`).
 */
export interface EntitlementDto {
  isPremium: boolean;
}
