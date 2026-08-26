import type { Role, UpdateAdminUserRoleRequestDto } from "@loomkeep/shared";
import { Role as RoleValues } from "@loomkeep/shared";
import { IsIn } from "class-validator";

export class UpdateAdminUserRoleDto implements UpdateAdminUserRoleRequestDto {
  @IsIn(Object.values(RoleValues))
  role!: Role;
}
