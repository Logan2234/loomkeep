import type { ApiKeyResource } from "@loomkeep/shared";
import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiV1CommonErrors } from "../public-api/v1/api-responses";
import { AllowApiKey } from "./api-key-access.decorator";
import { PublicApiGuard } from "./public-api.guard";

/**
 * Everything a public API controller needs: opened to API keys for one
 * resource, turned off with the instance setting, metered by the per-account quota instead of the per-IP throttle
 * the rest of the API uses, and tagged for its OpenAPI document.
 */
export const PublicApi = (tag: string, resource: ApiKeyResource | null) =>
  applyDecorators(
    ApiTags(tag),
    ApiBearerAuth(),
    ApiV1CommonErrors(),
    AllowApiKey(resource),
    SkipThrottle(),
    UseGuards(PublicApiGuard),
  );
