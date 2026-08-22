import { Module } from "@nestjs/common";
import { EntitlementService } from "./entitlement.service";

@Module({
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementModule {}
