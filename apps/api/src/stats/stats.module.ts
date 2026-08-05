import { Module } from "@nestjs/common";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [ReviewsModule, UsersModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
