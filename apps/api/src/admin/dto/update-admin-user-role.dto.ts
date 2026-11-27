import type { UpdateAdminUserRoleRequestDto } from "@loomkeep/shared/contracts";
import type { Role } from "@loomkeep/shared/enums";
import { Role as RoleValues } from "@loomkeep/shared/enums";
import { IsIn } from "class-validator";

export class UpdateAdminUserRoleDto implements UpdateAdminUserRoleRequestDto {
  @IsIn(Object.values(RoleValues))
  role!: Role;
}
