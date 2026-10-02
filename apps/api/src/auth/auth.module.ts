import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { MailModule } from "../mail/mail.module";
import { AdminAlertModule } from "../notifications/admin-alert.module";
import { NotificationModule } from "../notifications/notification.module";
import { SecurityModule } from "../security/security.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { InvitationService } from "./invitation.service";
import { MfaService } from "./mfa.service";
import { SessionsController } from "./sessions.controller";
import { TurnstileService } from "./turnstile.service";
import { VerificationController } from "./verification.controller";
import { WebauthnService } from "./webauthn.service";

@Module({
  // Secrets are provided per sign/verify call (access vs refresh), so no default here.
  // SessionCacheService comes from the global SessionCacheModule (see there
  // for why it isn't declared here directly).
  imports: [
    ApiKeysModule,
    JwtModule.register({ global: true }),
    MailModule,
    SecurityModule,
    GamificationModule,
    EventsModule,
    NotificationModule,
    AdminAlertModule,
  ],
  controllers: [AuthController, SessionsController, VerificationController],
  providers: [
    AuthService,
    TurnstileService,
    MfaService,
    WebauthnService,
    InvitationService,
  ],
  exports: [AuthService, MfaService, WebauthnService, InvitationService],
})
export class AuthModule {}
