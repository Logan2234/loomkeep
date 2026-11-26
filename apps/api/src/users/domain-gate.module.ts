import { Module } from "@nestjs/common";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { DomainGateService } from "./domain-gate.service";

// Split out of UsersModule so SocialModule can use it: UsersModule already
// imports SocialModule, and importing it back would be circular.
@Module({
  imports: [EntitlementsModule],
  providers: [DomainGateService],
  exports: [DomainGateService],
})
export class DomainGateModule {}
