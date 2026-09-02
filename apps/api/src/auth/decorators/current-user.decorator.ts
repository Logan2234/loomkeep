import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export interface JwtPayload {
  /** User ID. */
  sub: string;
  email: string;
  /** Stable server-side session ID. */
  sid?: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JwtPayload;
}

/** Injects the JWT payload of the authenticated user into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as JwtPayload;
  },
);
