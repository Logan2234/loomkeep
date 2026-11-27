import type { AdminUserRoleDto } from "@loomkeep/shared/contracts";
import type { Role } from "@loomkeep/shared/enums";

export class AdminUserRoleResponseDto implements AdminUserRoleDto {
  role!: Role;
}
