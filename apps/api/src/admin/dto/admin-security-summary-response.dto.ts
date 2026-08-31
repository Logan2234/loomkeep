import type {
  AdminFailedLoginTargetDto,
  AdminSecuritySummaryDto,
} from "@loomkeep/shared";

class AdminFailedLoginTargetResponseDto implements AdminFailedLoginTargetDto {
  identifier!: string;
  failures!: number;
}

export class AdminSecuritySummaryResponseDto implements AdminSecuritySummaryDto {
  loginFailed24h!: number;
  loginFailed7d!: number;
  loginFailed30d!: number;
  loginFailedTotal!: number;
  topTargets7d!: AdminFailedLoginTargetResponseDto[];
}
