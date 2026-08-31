import type { AdminPushDeviceDto } from "@loomkeep/shared";

export class AdminPushDeviceResponseDto implements AdminPushDeviceDto {
  id!: string;
  userAgent!: string | null;
  createdAt!: string;
}
