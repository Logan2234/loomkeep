import { Global, Module } from "@nestjs/common";
import { ApiKeyAuthService } from "./api-key-auth.service";

// Global for the same reason as SessionCacheModule: the app-wide
// JwtAuthGuard resolves its dependencies from the root injector.
@Global()
@Module({
  providers: [ApiKeyAuthService],
  exports: [ApiKeyAuthService],
})
export class ApiKeyAuthModule {}
