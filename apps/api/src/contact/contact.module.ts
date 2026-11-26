import { Module } from "@nestjs/common";
import { TurnstileService } from "../auth/turnstile.service";
import { MailModule } from "../mail/mail.module";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";

@Module({
  imports: [MailModule],
  controllers: [ContactController],
  providers: [ContactService, TurnstileService],
})
export class ContactModule {}
