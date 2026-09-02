import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { SocialModule } from "../social/social.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

// P4 reviews. Owning-a-review CRUD is always available (rating works offline);
// reading others' reviews is gated by SocialFeatureGuard on the controller.
// Imports SocialModule for the shared VisibilityService, and re-exports it so
// the domain modules (which already import ReviewsModule) can inject the shared
// ActivityService for feed emission.
@Module({
  imports: [SocialModule, GamificationModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService, SocialModule],
})
export class ReviewsModule {}
