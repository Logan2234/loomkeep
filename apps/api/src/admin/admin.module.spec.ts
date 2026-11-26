import { MODULE_METADATA } from "@nestjs/common/constants";
import { AccountModule } from "../account/account.module";
import { InactiveAccountService } from "../account/inactive-account.service";
import { AdminModule } from "./admin.module";

describe("inactive-account cron registration", () => {
  it("registers one provider shared by the scheduled and admin paths", () => {
    const accountProviders = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AccountModule,
    ) as unknown[];
    const adminProviders = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AdminModule,
    ) as unknown[];
    const accountExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      AccountModule,
    ) as unknown[];

    expect(
      [...accountProviders, ...adminProviders].filter(
        (provider) => provider === InactiveAccountService,
      ),
    ).toHaveLength(1);
    expect(accountExports).toContain(InactiveAccountService);
  });
});
