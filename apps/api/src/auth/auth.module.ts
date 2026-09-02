import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { GamificationModule } from "../gamification/gamification.module";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MfaService } from "./mfa.service";
import { SessionsController } from "./sessions.controller";
import { TurnstileService } from "./turnstile.service";
import { VerificationController } from "./verification.controller";

@Module({
  // Secrets are provided per sign/verify call (access vs refresh), so no default here.
  imports: [
    JwtModule.register({ global: true }),
    MailModule,
    SecurityModule,
    GamificationModule,
  ],
  controllers: [AuthController, SessionsController, VerificationController],
  providers: [AuthService, TurnstileService, MfaService],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
