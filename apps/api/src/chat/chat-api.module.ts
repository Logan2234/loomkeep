import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { LibraryModule } from "../library/library.module";
import { LinksModule } from "../links/links.module";
import { MusicModule } from "../music/music.module";
import { ReportsModule } from "../reports/reports.module";
import { SocialModule } from "../social/social.module";
import { DomainGateModule } from "../users/domain-gate.module";
import { ChatCommandsService } from "./chat-commands.service";
import { ChatWorkService } from "./chat-work.service";
import { ChatController } from "./chat.controller";
import { ChatModule } from "./chat.module";
import { WorkThreadService } from "./work-thread.service";

// The Messages routes, behind ChatFeatureGuard (social and chat both on).
// ReportsModule files reports against a message; the catalogue modules turn a
// work page into the card a message carries.
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
  ],
  controllers: [ChatController],
  providers: [ChatWorkService, ChatCommandsService, WorkThreadService],
})
export class ChatApiModule {}
