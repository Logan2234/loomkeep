import { ApiPropertyOptional } from "@nestjs/swagger";

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

export class ApiV1ErrorResponseDto {
  /**
   * The HTTP status, repeated.
   * @example 401
   */
  statusCode!: number;

  /**
   * Stable error code, meant for your code: see the Errors guide.
   * @example "auth.invalid_api_key"
   */
  code!: string | null;

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
