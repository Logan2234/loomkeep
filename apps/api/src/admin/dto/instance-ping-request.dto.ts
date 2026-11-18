import { IsUUID, Matches, MaxLength } from "class-validator";

export class InstancePingRequestDto {
  /** Random id the instance generated for itself, see UpdateCheck.instanceId. */
  @IsUUID(4)
  instanceId!: string;

  @MaxLength(32)
  @Matches(/^\d+\.\d+\.\d+$/)
  version!: string;
}
