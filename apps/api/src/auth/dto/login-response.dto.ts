import type { LoginResponseDto, MfaMethod } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { AuthTokensResponseDto } from "./auth-tokens-response.dto";

// LoginResponseDto is a discriminated union — the swagger plugin can't
// infer a union directly, so each branch gets its own class and the
// controller composes them with @ApiExtraModels + oneOf. The plugin also
// widens a literal `true`/`false` property type to plain `boolean` on its
// own (JSON Schema has no boolean-literal type), which would erase the
// discriminant that the web needs to narrow the union — `enum: [true]` /
// `enum: [false]` below is what preserves it through codegen.
type LoginMfaChallenge = Extract<LoginResponseDto, { mfaRequired: true }>;
type LoginSuccess = Extract<LoginResponseDto, { mfaRequired: false }>;

export class LoginMfaChallengeResponseDto implements LoginMfaChallenge {
  @ApiProperty({ enum: [true] })
  mfaRequired!: true;

  challengeId!: string;
  availableMethods!: MfaMethod[];
}

export class LoginSuccessResponseDto implements LoginSuccess {
  @ApiProperty({ enum: [false] })
  mfaRequired!: false;

  user!: UserResponseDto;
  tokens!: AuthTokensResponseDto;
}
