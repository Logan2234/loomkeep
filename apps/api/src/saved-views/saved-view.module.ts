import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { SavedViewController } from "./saved-view.controller";
import { SavedViewService } from "./saved-view.service";

// UX-05: a library page's filters saved under a name.
@Module({
  imports: [EntitlementModule],
  controllers: [SavedViewController],
  providers: [SavedViewService],
})
export class SavedViewsModule {}
