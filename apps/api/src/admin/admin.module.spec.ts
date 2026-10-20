import { MODULE_METADATA } from "@nestjs/common/constants";
import { InactiveAccountService } from "../users/inactive-account.service";
import { UsersModule } from "../users/users.module";
import { AdminModule } from "./admin.module";

describe("inactive-account cron registration", () => {
  it("registers one provider shared by the scheduled and admin paths", () => {
    const usersProviders = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      UsersModule,
    ) as unknown[];
    const adminProviders = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AdminModule,
    ) as unknown[];
    const usersExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      UsersModule,
    ) as unknown[];

    expect(
      [...usersProviders, ...adminProviders].filter(
        (provider) => provider === InactiveAccountService,
      ),
    ).toHaveLength(1);
    expect(usersExports).toContain(InactiveAccountService);
  });
});
