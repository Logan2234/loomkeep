import type { InstancePingDto } from "@loomkeep/shared";
import { Matches, MaxLength } from "class-validator";

// A pattern rather than @IsUUID: no other DTO uses that constraint, which
// would need a web translation for a body the web never sends.
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InstancePingRequestDto implements InstancePingDto {
  /** Random id the instance generated for itself, see UpdateCheck.instanceId. */
  @Matches(UUID_V4)
  instanceId!: string;

  @MaxLength(32)
  @Matches(/^\d+\.\d+\.\d+$/)
  version!: string;
}
