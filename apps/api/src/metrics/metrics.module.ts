import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsGuard } from "./metrics.guard";
import { MetricsService } from "./metrics.service";

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsGuard],
  exports: [MetricsService],
})
export class MetricsModule {}
