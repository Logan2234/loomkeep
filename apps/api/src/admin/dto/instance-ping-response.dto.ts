import type { InstancePingResultDto } from "@loomkeep/shared";

export class InstancePingResponseDto implements InstancePingResultDto {
  latestVersion!: string;
}
