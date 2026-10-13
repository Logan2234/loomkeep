import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { LibraryModule } from "../library/library.module";
import { LinksModule } from "../links/links.module";
import { MusicModule } from "../music/music.module";
import { NotificationModule } from "../notifications/notification.module";
import { ReportsModule } from "../reports/reports.module";
import { SocialModule } from "../social/social.module";
import { DomainGateModule } from "../users/domain-gate.module";
import { AppBadgeService } from "./app-badge.service";
import { ChatCommandsService } from "./chat-commands.service";
import { ChatWorkService } from "./chat-work.service";
import { ChatController } from "./chat.controller";
import { ChatModule } from "./chat.module";
import { WorkThreadService } from "./work-thread.service";

// The Messages routes, behind ChatFeatureGuard (social and chat both on).
// ReportsModule files reports against a message; the catalogue modules turn a
// work page into the card a message carries. AppBadgeService sits here as the
// one module that sees both chat and the notifications.
@Module({
  imports: [
    ChatModule,
    ReportsModule,
    LinksModule,
    CatalogModule,
    GamesModule,
    BooksModule,
    MusicModule,
    DomainGateModule,
    LibraryModule,
    SocialModule,
    NotificationModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatWorkService,
    ChatCommandsService,
    WorkThreadService,
    AppBadgeService,
  ],
})
export class ChatApiModule {}
