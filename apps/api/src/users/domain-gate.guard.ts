import type { Domain } from "@loomkeep/shared/enums";
import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type {
  AuthenticatedRequest,
  JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { DomainGateService } from "./domain-gate.service";

export const DOMAIN_GATE = "domainGate";

/**
 * Closes every route of a domain's controller to a user for whom
 * {@link DomainGateService} says the domain is off — writes and sessions
 * included, not just search and lists. On the class, so a route added later
 * is gated without anyone remembering to.
 */
export const DomainGated = (domain: Domain) =>
  applyDecorators(SetMetadata(DOMAIN_GATE, domain), UseGuards(DomainGateGuard));

@Injectable()
export class DomainGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly domainGate: DomainGateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const domain = this.reflector.getAllAndOverride<Domain>(DOMAIN_GATE, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Behind the global JwtAuthGuard: a domain route is never public.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.domainGate.assertEnabled(
      (request.user as JwtPayload).sub,
      domain,
    );
    return true;
  }
}
