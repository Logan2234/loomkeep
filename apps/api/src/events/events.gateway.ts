import type { RealtimeEvent } from "@loomkeep/shared";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { readAccessCookie } from "../auth/auth-cookies";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import {
  JWT_ACCESS_AUDIENCE,
  JWT_ALGORITHM,
  JWT_ISSUER,
} from "../auth/jwt.constants";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";
import { isSocialEnabled } from "../social/social.config";

const ADMIN_REPORTS_ROOM = "admin:reports";
const userRoom = (userId: string) => `user:${userId}`;
const listRoom = (listId: string) => `list:${listId}`;
const commentsRoom = (targetType: string, targetId: string) =>
  `comments:${targetType}:${targetId}`;

/**
 * Single WebSocket entry point for the whole app — one connection per client,
 * multiplexed by room, rather than a gateway per domain. Every socket always
 * joins its own `user:{id}` room (private per-user pushes: notifications,
 * achievement unlocks, import progress — a job never has more than one
 * owner, so it rides this room instead of one of its own) and `admin:reports`
 * when the account is an admin. Shared-resource rooms (a list, a comment
 * thread) are joined on demand via an explicit message, checked against the
 * same access rules their REST endpoints enforce.
 *
 * Deliberately depends on nothing but the globally-registered PrismaService/
 * ConfigService/JwtService/FeatureFlagsService: every domain module that
 * needs to emit (notifications, reports, gamification, comments, lists,
 * import) imports this module one-directionally, so pulling any of those
 * modules in here in turn would create a cycle for no real benefit — the
 * join-time checks below only need read access to a couple of tables, not
 * the full service.
 */
// @WebSocketGateway's options are evaluated once at module-load time (before
// Nest's DI is available to inject ConfigService), same constraint as
// main.ts's own CORS setup — mirrored here directly from process.env for the
// same reason.
const webOrigins = (process.env.WEB_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: { origin: webOrigins, credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /**
   * Auth happens once, at the HTTP-upgrade handshake — there is no per-message
   * guard equivalent to JwtAuthGuard for a gateway. `readAccessCookie` is
   * reused as-is (it only needs `headers.cookie`, which a socket.io handshake
   * carries the same way a Fastify request does).
   *
   * A live-session revocation check (SessionCacheService, as JwtAuthGuard
   * does) is deliberately skipped here: wiring it in would need AuthModule,
   * which pulls in GamificationModule, which needs this module back for
   * AchievementService's own emit — a module cycle for a narrow edge case.
   * The disconnect-at-token-expiry below already bounds a revoked session's
   * exposure to at most the access token's remaining lifetime (≤15 min), the
   * same window an already-issued access token has on the REST side whenever
   * it has no `sid` to check.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = readAccessCookie({
        headers: { cookie: client.handshake.headers.cookie },
      });
      if (!token) throw new Error("No access token cookie");

      const payload = await this.jwtService.verifyAsync<
        JwtPayload & { exp: number }
      >(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: JWT_ACCESS_AUDIENCE,
      });

      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true },
      });
      if (user?.role === "ADMIN") await client.join(ADMIN_REPORTS_ROOM);

      const msUntilExpiry = payload.exp * 1000 - Date.now();
      this.expiryTimers.set(
        client.id,
        setTimeout(() => client.disconnect(true), Math.max(msUntilExpiry, 0)),
      );
    } catch (error) {
      this.logger.debug(
        `Rejecting socket ${client.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const timer = this.expiryTimers.get(client.id);

    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(client.id);
    }
  }

  /** Comments are entirely social-gated (see CommentController) — refused silently, same "don't advertise the surface" rule as the REST side. */
  @SubscribeMessage("join-comments")
  async handleJoinComments(
    client: Socket,
    { targetType, targetId }: { targetType: string; targetId: string },
  ): Promise<void> {
    if (!isSocialEnabled(this.config, this.flags)) return;
    await client.join(commentsRoom(targetType, targetId));
  }

  @SubscribeMessage("leave-comments")
  async handleLeaveComments(
    client: Socket,
    { targetType, targetId }: { targetType: string; targetId: string },
  ): Promise<void> {
    await client.leave(commentsRoom(targetType, targetId));
  }

  /** Owner or editor only — the same audience ListService.canEdit grants write access to. */
  @SubscribeMessage("join-list")
  async handleJoinList(client: Socket, listId: string): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !(await this.canAccessList(userId, listId))) return;
    await client.join(listRoom(listId));
  }

  @SubscribeMessage("leave-list")
  async handleLeaveList(client: Socket, listId: string): Promise<void> {
    await client.leave(listRoom(listId));
  }

  private async canAccessList(
    userId: string,
    listId: string,
  ): Promise<boolean> {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      select: { userId: true },
    });
    if (!list) return false;
    if (list.userId === userId) return true;
    if (!isSocialEnabled(this.config, this.flags)) return false;

    const member = await this.prisma.listMember.findUnique({
      where: { listId_userId: { listId, userId } },
    });
    return !!member;
  }

  emitToUser(userId: string, event: RealtimeEvent, payload?: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  emitReportsCount(): void {
    this.server.to(ADMIN_REPORTS_ROOM).emit("reports-count");
  }

  emitToList(listId: string, event: RealtimeEvent): void {
    this.server.to(listRoom(listId)).emit(event);
  }

  emitToCommentsThread(
    targetType: string,
    targetId: string,
    event: RealtimeEvent,
  ): void {
    this.server.to(commentsRoom(targetType, targetId)).emit(event, {
      targetType,
      targetId,
    });
  }
}
