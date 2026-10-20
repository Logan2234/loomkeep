import { Global, Module } from "@nestjs/common";
import { InstanceSettingsService } from "./instance-settings.service";

// Global: the settings gate features across every module.
@Global()
@Module({
  providers: [InstanceSettingsService],
  exports: [InstanceSettingsService],
})
export class InstanceSettingsModule {}
