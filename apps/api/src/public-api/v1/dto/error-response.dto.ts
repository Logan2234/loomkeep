import type { ApiErrorBody } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** The codes the public API can answer with; the rest are the web app's. */
const API_V1_ERROR_CODES = [
  ErrorCode.AuthInvalidApiKey,
  ErrorCode.AuthApiKeyForbidden,
  ErrorCode.ApiDisabled,
  ErrorCode.ApiRateLimited,
  ErrorCode.ValidationFailed,
  ErrorCode.UserDomainDisabled,
  ErrorCode.LibraryEntryNotFound,
  ErrorCode.ListNotFound,
  ErrorCode.GamificationFeatureDisabled,
  ErrorCode.InternalError,
];

class ApiV1ValidationDetailResponseDto {
  /**
   * The parameter at fault.
   * @example "lang"
   */
  field!: string;

  /**
   * The rule it broke.
   * @example "isIn"
   */
  constraint!: string;
}

export class ApiV1ErrorResponseDto implements ApiErrorBody {
  /**
   * The HTTP status, repeated.
   * @example 401
   */
  statusCode!: number;

  @ApiProperty({
    enum: API_V1_ERROR_CODES,
    nullable: true,
    description:
      "Stable error code, meant for your code: see the Errors guide.",
    example: "auth.invalid_api_key",
  })
  code!: ErrorCode | null;

  /**
   * A hint for humans; may change.
   * @example "auth.invalid_api_key"
   */
  message!: string;

  /**
   * Quote it when asking for help: it finds the request in the logs.
   * @example "req-1x"
   */
  requestId!: string;

  /** The parameters at fault, for `validation.failed`. */
  @ApiPropertyOptional({
    type: ApiV1ValidationDetailResponseDto,
    isArray: true,
  })
  details?: ApiV1ValidationDetailResponseDto[];
}
