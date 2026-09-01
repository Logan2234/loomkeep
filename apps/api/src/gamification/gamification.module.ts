import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { XpService } from "./xp.service";

// G1: XP ledger + level curve. No controller yet — this ticket only wires
// the ledger itself and one witness caller (LibraryService); the
// leaderboard/profile endpoints are later tickets ([G7]+).
@Module({
  imports: [JobsModule],
  providers: [XpService],
  exports: [XpService],
})
export class GamificationModule {}
