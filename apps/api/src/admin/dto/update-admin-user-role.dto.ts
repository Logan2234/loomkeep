import { IsIn } from "class-validator";
import type { Role, UpdateAdminUserRoleRequestDto } from "@loomkeep/shared";
import { Role as RoleValues } from "@loomkeep/shared";

export class UpdateAdminUserRoleDto implements UpdateAdminUserRoleRequestDto {
  @IsIn(Object.values(RoleValues))
  role!: Role;
}
