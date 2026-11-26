import { defineConfig } from "eslint/config";
import { baseConfig } from "../../eslint.config.base.mjs";

const BARE_EXCEPTION_NAMES =
  "BadRequest|NotFound|Forbidden|Unauthorized|Conflict|Gone|" +
  "BadGateway|ServiceUnavailable|InternalServerError";

const NO_BARE_EXCEPTION = {
  selector: `NewExpression[callee.name=/^(${BARE_EXCEPTION_NAMES})Exception$/]`,
  message:
    "Throw an AppException (apps/api/src/common/app.exception.ts) with an ErrorCode from @loomkeep/shared instead — a bare NestJS exception has no code the web app can translate.",
};

// Premium is a seam, not sold yet: isEffectivelyPremium() answers true for
// everyone while the premium-features flag is off. Only the raw-plan readers
// listed below the rule call hasPremium() (see CLAUDE.md).
const NO_RAW_PREMIUM_CHECK = {
  selector: "CallExpression[callee.property.name='hasPremium']",
  message:
    "Call EntitlementService.isEffectivelyPremium(): hasPremium() is the raw plan, read only by GET /users/me/entitlement and the API quota.",
};

export default defineConfig(
  ...baseConfig(import.meta.dirname),
  // Plain CJS vitest setup scripts, not part of the app tsconfig (no allowJs) —
  // same rationale as the *.config.* exclusion in the shared base.
  { ignores: ["test/e2e-env.js", "test/global-setup.js"] },
  {
    // Business code should throw AppException (packages/shared ErrorCode +
    // apps/api/src/common/app.exception.ts) so apps/web can translate it —
    // a bare NestJS *Exception carries no code and only gets a generic
    // per-status fallback message. Tests are exempt: they still construct
    // these to assert on thrown types/status, which is fine.
    //
    // A new bare exception would bypass the translated error-code contract.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.spec.ts"],
    rules: { "no-restricted-syntax": ["error", NO_BARE_EXCEPTION] },
  },
  {
    // Same files minus the raw-plan readers. Repeats NO_BARE_EXCEPTION: a
    // later block's no-restricted-syntax replaces an earlier one's.
    files: ["src/**/*.ts"],
    ignores: [
      "src/**/*.spec.ts",
      "src/entitlements/entitlement.service.ts",
      "src/users/users.service.ts",
      "src/api-keys/api-rate-limit.service.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_BARE_EXCEPTION,
        NO_RAW_PREMIUM_CHECK,
      ],
    },
  },
  {
    // ee/ is under LICENSE-EE, not the AGPL: the core must run without it,
    // so only the composition root may import it.
    files: ["src/**/*.ts"],
    ignores: ["src/ee/**", "src/app.module.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ee", "**/ee/**"],
              message:
                "The AGPL core must not depend on ee/ (LICENSE-EE) — only app.module.ts registers EeModule.",
            },
          ],
        },
      ],
    },
  },
);
