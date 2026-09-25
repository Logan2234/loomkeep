import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { DomainGateService } from "./domain-gate.service";

// Split out of UsersModule so SocialModule can use it: UsersModule already
// imports SocialModule, and importing it back would be circular.
@Module({
  imports: [EntitlementModule],
  providers: [DomainGateService],
  exports: [DomainGateService],
})
export class DomainGateModule {}
