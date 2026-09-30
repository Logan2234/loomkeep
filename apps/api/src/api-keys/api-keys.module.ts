import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";

@Module({
  imports: [MailModule, SecurityModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
})
export class ApiKeysModule {}
