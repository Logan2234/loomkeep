import type { InstancePingResultDto } from "@loomkeep/shared/contracts";

export class InstancePingResponseDto implements InstancePingResultDto {
  latestVersion!: string;
}
