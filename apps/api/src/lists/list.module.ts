import { Module } from "@nestjs/common";
import { NotificationModule } from "../notifications/notification.module";
import { SocialModule } from "../social/social.module";
import { ListController } from "./list.controller";
import { ListService } from "./list.service";

// P4 lists (increment 5). Owning-a-list CRUD is always available (curating
// your own private lists works offline); reading someone else's shared list
// is gated by SocialFeatureGuard on the controller — same split as reviews.
@Module({
  imports: [SocialModule, NotificationModule],
  controllers: [ListController],
  providers: [ListService],
  exports: [ListService],
})
export class ListsModule {}
