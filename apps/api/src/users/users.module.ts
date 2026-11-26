import { Module } from "@nestjs/common";
import { AccountModule } from "../account/account.module";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { SocialModule } from "../social/social.module";
import { MfaController } from "./mfa.controller";
import { UserGatesModule } from "./user-gates.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

// The signed-in user's own routes (/users/me…). Nothing imports it: what other
// modules need about a user lives in UserGatesModule, an account's deletion
// and export in AccountModule.
@Module({
  imports: [
    AccountModule,
    ApiKeysModule,
    AuthModule,
    EntitlementsModule,
    EventsModule,
    GamificationModule,
    MailModule,
    SecurityModule,
    SocialModule,
    UserGatesModule,
  ],
  controllers: [UsersController, MfaController],
  providers: [UsersService],
})
export class UsersModule {}
