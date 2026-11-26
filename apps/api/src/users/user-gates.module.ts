import { Module } from "@nestjs/common";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { AgeGateService } from "./age-gate.service";
import { DomainGateService } from "./domain-gate.service";

// What every module needs to know about the user in front of it: whether a
// domain is open to them (DomainGateService) and whether an 18+ title may be
// shown (AgeGateService). Kept apart from UsersModule, which sits at the top
// of the module graph, so the catalog and domain modules can import it.
@Module({
  imports: [EntitlementsModule],
  providers: [AgeGateService, DomainGateService],
  exports: [AgeGateService, DomainGateService],
})
export class UserGatesModule {}
