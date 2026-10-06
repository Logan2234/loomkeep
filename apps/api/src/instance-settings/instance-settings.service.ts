import type {
  InstanceSettingKey,
  InstanceSettingsDto,
  InstanceSettingsValues,
  UpdateInstanceSettingsDto,
} from "@loomkeep/shared";
import { ErrorCode, INSTANCE_SETTING_ENV } from "@loomkeep/shared";
import { HttpStatus, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { InstanceSettings } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
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

    for (const key of KEYS) {
      if (envOverride(this.config, key) !== null) {
        lockedBy[key] = INSTANCE_SETTING_ENV[key];
      }
    }

    return {
      values: Object.fromEntries(
        KEYS.map((key) => [key, this.get(key)]),
      ) as unknown as InstanceSettingsValues,
      lockedBy,
    };
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
  };
}
