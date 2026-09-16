import { RealtimeEvent } from "@loomkeep/shared";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { SkipThrottle } from "@nestjs/throttler";
import {
  ConnectedSocket,
  MessageBody,
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
import { SessionCacheService } from "../auth/session-cache.service";
import { isSessionLive } from "../auth/session-live.util";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";
import { isSocialEnabled } from "../social/social.config";

const ADMIN_REPORTS_ROOM = "admin:reports";
const userRoom = (userId: string) => `user:${userId}`;
const sessionRoom = (sessionId: string) => `session:${sessionId}`;
const listRoom = (listId: string) => `list:${listId}`;
const commentsRoom = (targetType: string, targetId: string) =>
  `comments:${targetType}:${targetId}`;

type CommentRoomMembership = {
  targetType: string;
  targetId: string;
  userId: string;
};

/**
 * Single WebSocket entry point for the whole app — one connection per client,
 * multiplexed by room, rather than a gateway per domain. Every socket always
 * joins its own `user:{id}` room (private per-user pushes: notifications,
 * achievement unlocks, import progress — a job never has more than one
 * owner, so it rides this room instead of one of its own), `admin:reports`
 * when the account is an admin, and `session:{sid}` when its token carries
 * one (lets `disconnectSession` cut a specific device's socket the moment
 * that session is revoked, without touching that user's other devices).
 * Shared-resource rooms (a list, a comment thread) are joined on demand via
 * an explicit message, checked against the same access rules their REST
 * endpoints enforce.
 *
 * Deliberately depends on nothing but the globally-registered PrismaService/
 * ConfigService/JwtService/FeatureFlagsService/SessionCacheService: every
 * domain module that needs to emit (notifications, reports, gamification,
 * comments, lists, import) imports this module one-directionally, so pulling
 * any of those modules in here in turn would create a cycle for no real
 * benefit — the join-time checks below only need read access to a couple of
 * tables, not the full service.
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
  // @nestjs/platform-fastify's raw http.Server never completes engine.io's
  // polling→websocket upgrade handshake (confirmed with curl: it 101s then
  // hangs, never sending the expected probe packet) — polling would just be
  // a transport every client immediately fails to upgrade out of, so it's
  // turned off server-side too rather than only on the web client.
  transports: ["websocket"],
  // The access-token cookie is scoped to `Path=/api` (see auth-cookies.ts) —
  // socket.io's default `/socket.io` path falls outside that scope, so the
  // browser never attaches the cookie to the handshake at all and
  // handleConnection's auth fails on every single connection, immediately
  // (confirmed with an instrumented WebSocket: connect → auth-reject
  // disconnect in under 5ms, every time, independent of token freshness).
  // Nesting under `/api` puts the handshake back in the cookie's path.
  path: "/api/socket.io",
})
// The global ThrottlerGuard (APP_GUARD) runs for every context type too, and
// tries to set rate-limit headers on a `res` that doesn't exist in a WS
// context — crashes the same way the global JwtAuthGuard did before its own
// `getType() !== "http"` guard. No rate limiting to lose here: a socket
// already only exists because handleConnection's own auth accepted it.
@SkipThrottle()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();
  private readonly commentRoomMembers = new Map<
    string,
    Map<string, Set<string>>
  >();

  private readonly commentRoomsBySocket = new Map<
    string,
    Map<string, CommentRoomMembership>
  >();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  /**
   * Auth happens once, at the HTTP-upgrade handshake — there is no per-message
   * guard equivalent to JwtAuthGuard for a gateway. `readAccessCookie` is
   * reused as-is (it only needs `headers.cookie`, which a socket.io handshake
   * carries the same way a Fastify request does), and so is `isSessionLive`
   * (shared with JwtAuthGuard) — a token whose session was just revoked
   * ("forcer la déconnexion", logout-elsewhere, password reset) is rejected
   * here exactly like it would be on the REST side, instead of only aging out
   * once its own expiry timer below fires.
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

      // A token signed before `sid` existed can't be checked against a live
      // session — treated as valid, same call this guard's REST counterpart
      // makes (JwtAuthGuard.canActivate).
      if (
        payload.sid &&
        !(await isSessionLive(this.prisma, this.sessionCache, payload.sid))
      ) {
        throw new Error("Session revoked");
      }

      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
      if (payload.sid) await client.join(sessionRoom(payload.sid));

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

    const memberships = this.commentRoomsBySocket.get(client.id);
    if (!memberships) return;

    for (const membership of memberships.values()) {
      this.removeCommentRoomMember(
        client.id,
        membership.targetType,
        membership.targetId,
      );
      this.emitCommentPresence(membership.targetType, membership.targetId);
    }
  }

  /** Comments are entirely social-gated (see CommentController) — refused silently, same "don't advertise the surface" rule as the REST side. */
  @SubscribeMessage("join-comments")
  async handleJoinComments(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { targetType, targetId }: { targetType: string; targetId: string },
  ): Promise<void> {
    if (!isSocialEnabled(this.config, this.flags)) return;
    await client.join(commentsRoom(targetType, targetId));

    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    this.addCommentRoomMember(client.id, userId, targetType, targetId);
    this.emitCommentPresence(targetType, targetId);
  }

  @SubscribeMessage("leave-comments")
  async handleLeaveComments(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { targetType, targetId }: { targetType: string; targetId: string },
  ): Promise<void> {
    await client.leave(commentsRoom(targetType, targetId));

    if (this.removeCommentRoomMember(client.id, targetType, targetId)) {
      this.emitCommentPresence(targetType, targetId);
    }
  }

  /** Owner or editor only — the same audience ListService.canEdit grants write access to. */
  @SubscribeMessage("join-list")
  async handleJoinList(
    @ConnectedSocket() client: Socket,
    @MessageBody() listId: string,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !(await this.canAccessList(userId, listId))) return;
    await client.join(listRoom(listId));
  }

  @SubscribeMessage("leave-list")
  async handleLeaveList(
    @ConnectedSocket() client: Socket,
    @MessageBody() listId: string,
  ): Promise<void> {
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

  private addCommentRoomMember(
    socketId: string,
    userId: string,
    targetType: string,
    targetId: string,
  ): void {
    const room = commentsRoom(targetType, targetId);
    const members = this.commentRoomMembers.get(room) ?? new Map();
    const sockets = members.get(userId) ?? new Set();
    sockets.add(socketId);
    members.set(userId, sockets);
    this.commentRoomMembers.set(room, members);

    const rooms = this.commentRoomsBySocket.get(socketId) ?? new Map();
    rooms.set(room, { targetType, targetId, userId });
    this.commentRoomsBySocket.set(socketId, rooms);
  }

  private removeCommentRoomMember(
    socketId: string,
    targetType: string,
    targetId: string,
  ): boolean {
    const room = commentsRoom(targetType, targetId);
    const membership = this.commentRoomsBySocket.get(socketId)?.get(room);
    if (!membership) return false;

    const members = this.commentRoomMembers.get(room);
    const sockets = members?.get(membership.userId);
    sockets?.delete(socketId);
    if (sockets?.size === 0) members?.delete(membership.userId);
    if (members?.size === 0) this.commentRoomMembers.delete(room);

    const rooms = this.commentRoomsBySocket.get(socketId);
    rooms?.delete(room);
    if (rooms?.size === 0) this.commentRoomsBySocket.delete(socketId);
    return true;
  }

  private emitCommentPresence(targetType: string, targetId: string): void {
    const room = commentsRoom(targetType, targetId);
    const count = this.commentRoomMembers.get(room)?.size ?? 0;
    this.server.to(room).emit(RealtimeEvent.COMMENT_PRESENCE, {
      targetType,
      targetId,
      count,
    });
  }

  emitToUser(userId: string, event: RealtimeEvent, payload?: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  emitReportsCount(): void {
    this.server.to(ADMIN_REPORTS_ROOM).emit(RealtimeEvent.REPORTS_COUNT);
  }

  /** Forces the socket(s) for one specific session (device) to disconnect — called wherever AuthService revokes a session, so a WS connection notices a revocation immediately instead of waiting out its own expiry timer. */
  disconnectSession(sessionId: string): void {
    this.server.in(sessionRoom(sessionId)).disconnectSockets(true);
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
