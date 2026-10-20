import { Module } from "@nestjs/common";
import { AdminAlertService } from "./admin-alert.service";
import { PushModule } from "./push.module";

@Module({
  imports: [PushModule],
  providers: [AdminAlertService],
  exports: [AdminAlertService],
})
export class AdminAlertModule {}
