import type { AdminUserOptionDto } from "@loomkeep/shared";

export class AdminUserOptionResponseDto implements AdminUserOptionDto {
  id!: string;
  displayName!: string;
  email!: string;
}
