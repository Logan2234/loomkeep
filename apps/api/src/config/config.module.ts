import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { PublicConfigController } from "./public-config.controller";

// Exposes the deployment's public runtime flags (see PublicConfigDto). Named
// RuntimeConfigModule to avoid confusion with @nestjs/config's ConfigModule.
@Module({
  imports: [MailModule],
  controllers: [PublicConfigController],
})
export class RuntimeConfigModule {}
