import { defineConfig } from "eslint/config";
import { baseConfig } from "../../eslint.config.base.mjs";

const BARE_EXCEPTION_NAMES =
  "BadRequest|NotFound|Forbidden|Unauthorized|Conflict|Gone|" +
  "BadGateway|ServiceUnavailable|InternalServerError";

export default defineConfig(
  ...baseConfig(import.meta.dirname),
  // Plain CJS jest setup scripts, not part of the app tsconfig (no allowJs) —
  // same rationale as the *.config.* exclusion in the shared base.
  { ignores: ["test/e2e-env.js", "test/global-setup.js"] },
  {
    // Business code should throw AppException (packages/shared ErrorCode +
    // apps/api/src/common/app.exception.ts) so apps/web can translate it —
    // a bare NestJS *Exception carries no code and only gets a generic
    // per-status fallback message. Tests are exempt: they still construct
    // these to assert on thrown types/status, which is fine.
    //
    // "error": every call site was migrated by the "Migrate API errors to
    // error codes, domain by domain" ticket — a new bare exception is a
    // regression, not pre-existing debt.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `NewExpression[callee.name=/^(${BARE_EXCEPTION_NAMES})Exception$/]`,
          message:
            "Throw an AppException (apps/api/src/common/app.exception.ts) with an ErrorCode from @loomkeep/shared instead — a bare NestJS exception has no code the web app can translate.",
        },
      ],
    },
  },
);
