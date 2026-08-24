import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { EntitlementService } from "./entitlement.service";

@Module({
  imports: [FeatureFlagsModule],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementModule {}
