import type { AdminUserXpDto } from "@loomkeep/shared/contracts";

export class AdminUserXpResponseDto implements AdminUserXpDto {
  xp!: number;
}
