import type { AuthResultResponseDto as AuthResultResponse } from "@loomkeep/shared/contracts";
import { UserResponseDto } from "../../users/dto/user-response.dto";

export class AuthResultResponseDto implements AuthResultResponse {
  user!: UserResponseDto;
}
