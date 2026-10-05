import { applyDecorators } from "@nestjs/common";
import type { ApiResponseNoStatusOptions } from "@nestjs/swagger";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { RATE_LIMIT_HEADERS } from "../../common/rate-limit-headers";
import { ApiV1ErrorResponseDto } from "./dto/error-response.dto";

const RATE_LIMIT_RESPONSE_HEADERS = {
  [RATE_LIMIT_HEADERS.limit]: {
    description: "Requests allowed per minute, for the whole account.",
    schema: { type: "integer", example: 60 },
  },
  [RATE_LIMIT_HEADERS.remaining]: {
    description: "Requests left in the current minute.",
    schema: { type: "integer", example: 57 },
  },
  [RATE_LIMIT_HEADERS.reset]: {
    description: "Seconds until the minute starts over.",
    schema: { type: "integer", example: 42 },
  },
};

const error = (statusCode: number, code: string) => ({
  type: ApiV1ErrorResponseDto,
  example: { statusCode, code, message: code, requestId: "req-1x" },
});

/** A success, with the quota headers every public response carries. */
export const ApiV1OkResponse = (options: ApiResponseNoStatusOptions) =>
  ApiOkResponse({ ...options, headers: RATE_LIMIT_RESPONSE_HEADERS });

/** The failures every public route shares: the key, its scope, the quota. */
export const ApiV1CommonErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({
      description:
        "No `Authorization: Bearer` header (`auth.missing_access_token`), or a key that is malformed, unknown, expired or revoked (`auth.invalid_api_key`).",
      ...error(401, "auth.invalid_api_key"),
    }),
    ApiForbiddenResponse({
      description:
        "The key wasn't granted this resource (`auth.api_key_forbidden`), or the instance has turned its public API off (`api.disabled`).",
      ...error(403, "auth.api_key_forbidden"),
    }),
    ApiTooManyRequestsResponse({
      description:
        "The account has spent its requests for the minute (`api.rate_limited`). Retry after `Retry-After` seconds.",
      headers: {
        ...RATE_LIMIT_RESPONSE_HEADERS,
        [RATE_LIMIT_HEADERS.retryAfter]: {
          description: "Seconds to wait before the next request.",
          schema: { type: "integer", example: 42 },
        },
      },
      ...error(429, "api.rate_limited"),
    }),
  );

export const ApiV1BadRequest = () =>
  ApiBadRequestResponse({
    description:
      "A query parameter is invalid (`validation.failed`); `details` names it.",
    type: ApiV1ErrorResponseDto,
    example: {
      statusCode: 400,
      code: "validation.failed",
      message: "lang: isIn",
      requestId: "req-1x",
      details: [{ field: "lang", constraint: "isIn" }],
    },
  });

export const ApiV1NotFound = (code: string, description: string) =>
  ApiNotFoundResponse({ description, ...error(404, code) });
