import type { ApiKeyResource } from "@loomkeep/shared";
import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { AllowApiKey } from "./api-key-access.decorator";
import { ApiRateLimitGuard } from "./api-rate-limit.guard";

/**
 * Everything a public API controller needs: opened to API keys for one
 * resource, metered by the per-account quota instead of the per-IP throttle
 * the rest of the API uses, and tagged for its OpenAPI document.
 */
export const PublicApi = (tag: string, resource: ApiKeyResource | null) =>
  applyDecorators(
    ApiTags(tag),
    ApiBearerAuth(),
    AllowApiKey(resource),
    SkipThrottle(),
    UseGuards(ApiRateLimitGuard),
  );
