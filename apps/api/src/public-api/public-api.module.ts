import { Module } from "@nestjs/common";
import { MeV1Controller } from "./v1/me.controller";
import { MeV1Service } from "./v1/me.service";

/** The versioned public API (`/api/v1`), the only surface API keys reach. */
@Module({
  controllers: [MeV1Controller],
  providers: [MeV1Service],
})
export class PublicApiModule {}
