import { ErrorCode } from "@loomkeep/shared/catalog";
import type {
  InstanceDomainAccountsDto,
  InstanceSettingKey,
  InstanceSettingsDto,
  InstanceSettingsValues,
  UpdateInstanceSettingsDto,
} from "@loomkeep/shared/contracts";
import {
  DEFAULT_INSTANCE_SETTINGS,
  DOMAIN_SETTING,
  type DomainSettingKey,
  INSTANCE_SETTING_ENV,
} from "@loomkeep/shared/contracts";
import { HttpStatus, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { InstanceSettings } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
import {
  INSTANCE_DOMAINS,
  instanceDomains,
  missingDomainEnv,
} from "./instance-domains";
import {
  envOverride,
  instanceSetting,
  setStoredInstanceSettings,
} from "./instance-settings.store";

const KEYS = Object.keys(INSTANCE_SETTING_ENV) as InstanceSettingKey[];

@Injectable()
export class InstanceSettingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The row is created on the first boot that has this table, from what the
   * env vars said then: an instance moving its configuration from `.env` to
   * the admin page can then drop the vars without anything changing.
   */
  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.instanceSettings.findUnique({
      where: { id: 1 },
    });
    const row =
      existing ??
      (await this.prisma.instanceSettings.create({
        data: { id: 1, ...this.toDto().values },
      }));
    setStoredInstanceSettings(toValues(row));
  }

  get<K extends InstanceSettingKey>(key: K): InstanceSettingsValues[K] {
    return instanceSetting(this.config, key);
  }

  toDto(): InstanceSettingsDto {
    const lockedBy: InstanceSettingsDto["lockedBy"] = {};
    const missingEnv: InstanceSettingsDto["missingEnv"] = {};

    for (const key of KEYS) {
      if (envOverride(this.config, key) !== null) {
        lockedBy[key] = INSTANCE_SETTING_ENV[key];
      }
    }

    for (const domain of INSTANCE_DOMAINS) {
      const missing = missingDomainEnv(this.config, domain);
      if (missing.length > 0) missingEnv[DOMAIN_SETTING[domain]] = missing;
    }

    return {
      values: KEYS.reduce(
        (values, key) => ({ ...values, [key]: this.get(key) }),
        { ...DEFAULT_INSTANCE_SETTINGS },
      ),
      lockedBy,
      missingEnv,
    };
  }

  async domainAccounts(): Promise<InstanceDomainAccountsDto> {
    const counts = await Promise.all(
      INSTANCE_DOMAINS.map((domain) =>
        this.prisma.user.count({ where: { enabledDomains: { has: domain } } }),
      ),
    );
    return Object.fromEntries(
      INSTANCE_DOMAINS.map((domain, i) => [domain, counts[i]]),
    ) as InstanceDomainAccountsDto;
  }

  async update(patch: UpdateInstanceSettingsDto): Promise<InstanceSettingsDto> {
    const locked = (Object.keys(patch) as InstanceSettingKey[]).find(
      (key) => envOverride(this.config, key) !== null,
    );

    if (locked) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AdminSettingLockedByEnv,
        { setting: locked, env: INSTANCE_SETTING_ENV[locked] },
      );
    }

    const domainSettings = Object.fromEntries(
      Object.values(DOMAIN_SETTING).map((key) => [
        key,
        patch[key] ?? this.get(key),
      ]),
    ) as Record<DomainSettingKey, boolean>;
    const offered = instanceDomains(this.config, domainSettings);

    if (!INSTANCE_DOMAINS.some((domain) => offered.includes(domain))) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.AdminNoDomainLeft);
    }

    const row = await this.prisma.instanceSettings.upsert({
      where: { id: 1 },
      create: patch,
      update: patch,
    });
    setStoredInstanceSettings(toValues(row));
    return this.toDto();
  }
}

function toValues(row: InstanceSettings): InstanceSettingsValues {
  return {
    socialEnabled: row.socialEnabled,
    chatEnabled: row.chatEnabled,
    gamificationEnabled: row.gamificationEnabled,
    registrationEnabled: row.registrationEnabled,
    publicApiEnabled: row.publicApiEnabled,
    apiRateLimitFree: row.apiRateLimitFree,
    apiRateLimitPremium: row.apiRateLimitPremium,
    updateCheckEnabled: row.updateCheckEnabled,
    telemetryEnabled: row.telemetryEnabled,
    askAcquisitionSource: row.askAcquisitionSource,
    mediaDomainEnabled: row.mediaDomainEnabled,
    gamesDomainEnabled: row.gamesDomainEnabled,
    booksDomainEnabled: row.booksDomainEnabled,
    musicDomainEnabled: row.musicDomainEnabled,
  };
}
