import type { PushDeviceCountDto } from "@loomkeep/shared";

export class PushDeviceCountResponseDto implements PushDeviceCountDto {
  /**
   * Devices of the account subscribed to web push.
   * @example 2
   */
  count!: number;
}
