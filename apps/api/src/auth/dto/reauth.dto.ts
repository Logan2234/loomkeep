import {
  REAUTH_METHODS,
  type ReauthMethod,
  type ReauthRequestDto,
} from "@loomkeep/shared";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class ReauthDto implements ReauthRequestDto {
  @IsIn(REAUTH_METHODS)
  method!: ReauthMethod;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  webauthnChallengeId?: string;

  @IsOptional()
  @IsObject()
  response?: AuthenticationResponseJSON;
}
