import type { AdminUserRoleDto, Role } from "@loomkeep/shared";

export class AdminUserRoleResponseDto implements AdminUserRoleDto {
  role!: Role;
}
