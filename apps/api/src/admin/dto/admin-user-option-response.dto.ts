import type { AdminUserOptionDto } from "@loomkeep/shared/contracts";

export class AdminUserOptionResponseDto implements AdminUserOptionDto {
  id!: string;
  displayName!: string;
  email!: string;
}
