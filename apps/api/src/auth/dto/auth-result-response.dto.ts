import { UserResponseDto } from "../../users/dto/user-response.dto";
import type { AuthResult } from "../auth.service";
import { AuthTokensResponseDto } from "./auth-tokens-response.dto";

export class AuthResultResponseDto implements AuthResult {
  user!: UserResponseDto;
  tokens!: AuthTokensResponseDto;
}
