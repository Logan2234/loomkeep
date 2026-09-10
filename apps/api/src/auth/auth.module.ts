import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { GamificationModule } from "../gamification/gamification.module";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MfaService } from "./mfa.service";
import { SessionCacheService } from "./session-cache.service";
import { SessionsController } from "./sessions.controller";
import { TurnstileService } from "./turnstile.service";
import { VerificationController } from "./verification.controller";
import { WebauthnService } from "./webauthn.service";

@Module({
  // Secrets are provided per sign/verify call (access vs refresh), so no default here.
  imports: [
    JwtModule.register({ global: true }),
    MailModule,
    SecurityModule,
    GamificationModule,
  ],
  controllers: [AuthController, SessionsController, VerificationController],
  providers: [
    AuthService,
    TurnstileService,
    MfaService,
    WebauthnService,
    SessionCacheService,
  ],
  // SessionCacheService is also exported for JwtAuthGuard, registered as a
  // global APP_GUARD in AppModule (which imports AuthModule directly).
  exports: [AuthService, MfaService, WebauthnService, SessionCacheService],
})
export class AuthModule {}
