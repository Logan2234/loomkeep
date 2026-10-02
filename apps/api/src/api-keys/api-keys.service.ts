import type {
  ApiKeyDto,
  ApiKeyScope,
  CreateApiKeyDto,
  CreatedApiKeyDto,
} from "@loomkeep/shared";
import {
  API_KEY_SCOPES,
  ErrorCode,
  MAX_API_KEYS_PER_USER,
  NotificationType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { ApiKey } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { InstanceSettingsService } from "../instance-settings/instance-settings.service";
import { MailService } from "../mail/mail.service";
import { notificationCopy } from "../notifications/notification-copy";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { ApiKeyAuthService, hashApiKey } from "./api-key-auth.service";
import { generateApiKeySecret } from "./api-key-format";

const SUFFIX_LENGTH = 4;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: ApiKeyAuthService,
    private readonly security: SecurityEventService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
    private readonly settings: InstanceSettingsService,
  ) {}

  async list(userId: string): Promise<ApiKeyDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return keys.map(toApiKeyDto);
  }

  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyDto> {
    if (!this.settings.get("publicApiEnabled")) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ApiDisabled);
    }

    const expiresAt = dto.expiresAt === null ? null : new Date(dto.expiresAt);

    if (expiresAt && expiresAt <= new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ApiKeyExpiryInPast,
      );
    }

    const count = await this.prisma.apiKey.count({ where: { userId } });

    if (count >= MAX_API_KEYS_PER_USER) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ApiKeyLimitReached,
      );
    }

    const secret = generateApiKeySecret();
    const name = dto.name.trim();
    const key = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        tokenHash: hashApiKey(secret),
        suffix: secret.slice(-SUFFIX_LENGTH),
        scopes: API_KEY_SCOPES.filter((scope) => dto.scopes.includes(scope)),
        expiresAt,
      },
      include: { user: { select: { email: true, locale: true } } },
    });

    const occurredAt = await this.security.record({
      type: "API_KEY_CREATED",
      userId,
      detail: name,
    });
    await this.mail.sendApiKeyCreated(key.user, name, occurredAt);

    return { apiKey: toApiKeyDto(key), secret };
  }

  async revokeAll(userId: string): Promise<void> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    await this.prisma.apiKey.deleteMany({ where: { userId } });

    for (const key of keys) {
      this.auth.invalidate(key.id);
      await this.security.record({
        type: "API_KEY_REVOKED",
        userId,
        detail: key.name,
      });
    }
  }

  /**
   * A password change leaves API keys valid — a key isn't a session. When
   * some are active, the bell says so (the password email does too, through
   * the count returned here), so whoever changed it can review them.
   */
  async reviewAfterPasswordChange(userId: string): Promise<number> {
    const count = await this.prisma.apiKey.count({
      where: activeKeysWhere(userId),
    });

    if (count > 0) {
      const copy = (await this.notifications.copyFor(userId)).apiKeys;
      await this.notifications.create({
        userId,
        type: NotificationType.API_KEYS_REVIEW,
        title: copy.reviewTitle,
        body: copy.reviewBody(count),
        url: "/app/settings/integrations",
        data: { count },
      });
    }

    return count;
  }

  /**
   * A key GitHub found in public: revoked rather than flagged, since anyone
   * can read it there. False when it isn't ours, or already gone.
   */
  async revokeLeaked(secret: string, foundAt: string | null): Promise<boolean> {
    const key = await this.prisma.apiKey.findUnique({
      where: { tokenHash: hashApiKey(secret) },
      include: { user: { select: { email: true, locale: true } } },
    });

    if (!key) return false;

    await this.prisma.apiKey.deleteMany({ where: { id: key.id } });
    this.auth.invalidate(key.id);
    const occurredAt = await this.security.record({
      type: "API_KEY_LEAKED",
      userId: key.userId,
      detail: key.name,
    });
    const copy = notificationCopy(key.user.locale).apiKeys;
    await this.notifications.create({
      userId: key.userId,
      type: NotificationType.API_KEY_LEAKED,
      title: copy.leakedTitle,
      body: copy.leakedBody(key.name),
      url: "/app/settings/integrations",
      data: { name: key.name, foundAt },
    });
    await this.mail.sendApiKeyLeaked(key.user, key.name, foundAt, occurredAt);
    return true;
  }

  async revoke(userId: string, id: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId },
      select: { name: true },
    });

    if (!key) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ApiKeyNotFound);
    }

    await this.prisma.apiKey.deleteMany({ where: { id, userId } });
    this.auth.invalidate(id);
    await this.security.record({
      type: "API_KEY_REVOKED",
      userId,
      detail: key.name,
    });
  }
}

/** Keys still able to authenticate: never-expiring, or not expired yet. */
function activeKeysWhere(userId: string, now = new Date()) {
  return {
    userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

function toApiKeyDto(key: ApiKey): ApiKeyDto {
  return {
    id: key.id,
    name: key.name,
    suffix: key.suffix,
    scopes: key.scopes as ApiKeyScope[],
    expiresAt: key.expiresAt?.toISOString() ?? null,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    lastUsedIp: key.lastUsedIp,
    createdAt: key.createdAt.toISOString(),
  };
}
