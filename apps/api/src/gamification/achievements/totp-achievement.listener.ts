import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TotpEnabledEvent } from "../../auth/auth.events";
import { AchievementService } from "./achievement.service";
import { ACHIEVEMENT_KEYS_ON_TOTP_ENABLED } from "./triggers";

/** Awards locked_down the moment an authenticator app is confirmed. */
@Injectable()
export class TotpAchievementListener {
  constructor(private readonly achievements: AchievementService) {}

  @OnEvent(TotpEnabledEvent.NAME)
  async onTotpEnabled(event: TotpEnabledEvent): Promise<void> {
    await this.achievements.evaluate(
      event.userId,
      ACHIEVEMENT_KEYS_ON_TOTP_ENABLED,
    );
  }
}
