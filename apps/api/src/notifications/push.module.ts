import { Module } from "@nestjs/common";
import { PushService } from "./push.service";

// Its own module so JobsModule can reach it: NotificationModule imports
// JobsModule, so the reverse would be a cycle.
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
