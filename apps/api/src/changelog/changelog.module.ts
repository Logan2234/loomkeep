import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { AdminChangelogController } from "./admin-changelog.controller";
import { ChangelogController } from "./changelog.controller";
import { ChangelogService } from "./changelog.service";

@Module({
  imports: [MailModule],
  controllers: [ChangelogController, AdminChangelogController],
  providers: [ChangelogService],
})
export class ChangelogModule {}
