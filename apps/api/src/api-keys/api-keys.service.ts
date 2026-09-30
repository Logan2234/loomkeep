import type {
  ApiKeyDto,
  ApiKeyScope,
  CreateApiKeyDto,
  CreatedApiKeyDto,
} from "@loomkeep/shared";
import {
  API_KEY_PREFIX,
  API_KEY_SCOPES,
  ErrorCode,
  MAX_API_KEYS_PER_USER,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { ApiKey } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AppException } from "../common/app.exception";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { ApiKeyAuthService, hashApiKey } from "./api-key-auth.service";

const SUFFIX_LENGTH = 4;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: ApiKeyAuthService,
    private readonly security: SecurityEventService,
    private readonly mail: MailService,
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

    const secret = API_KEY_PREFIX + randomBytes(32).toString("base64url");
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

    await this.security.record({
      type: "API_KEY_CREATED",
      userId,
      detail: name,
    });
    await this.mail.sendApiKeyCreated(key.user, name);

    return { apiKey: toApiKeyDto(key), secret };
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
