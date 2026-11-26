import { Global, Module } from "@nestjs/common";
import { HibpService } from "./hibp.service";

@Global()
@Module({
  providers: [HibpService],
  exports: [HibpService],
})
export class CommonModule {}
