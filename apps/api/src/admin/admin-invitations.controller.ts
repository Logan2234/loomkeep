import type {
  AdminInvitationDto,
  AdminInvitationLinkDto,
  PagedResult,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { InvitationService } from "../auth/invitation.service";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { DEFAULT_PAGE_SIZE, parsePageQuery } from "../common/pagination.util";
import { AdminOnly } from "./admin-only.decorator";
import { AdminInvitationLinkResponseDto } from "./dto/admin-invitation-link-response.dto";
import { AdminInvitationResponseDto } from "./dto/admin-invitation-response.dto";
import { CreateAdminInvitationDto } from "./dto/create-admin-invitation.dto";

/** Sign-up invitations (ADM-01), minted from the admin users screen. */
@AdminOnly()
@Controller("admin/invitations")
export class AdminInvitationsController {
  constructor(private readonly invitations: InvitationService) {}

  /** Every invitation, newest first — pending, used, expired and revoked alike. */
  @Get()
  @ApiOkResponse({ type: PagedResponseDto(AdminInvitationResponseDto) })
  list(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<AdminInvitationDto>> {
    return this.invitations.list(
      parsePageQuery(page, limit, DEFAULT_PAGE_SIZE),
    );
  }

  @Post()
  @ApiCreatedResponse({ type: AdminInvitationLinkResponseDto })
  create(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateAdminInvitationDto,
  ): Promise<AdminInvitationLinkDto> {
    return this.invitations.create(admin.sub, dto);
  }

  /** Mints a new link for it — the previous one stops working. */
  @Post(":id/renew")
  @ApiCreatedResponse({ type: AdminInvitationLinkResponseDto })
  renew(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
  ): Promise<AdminInvitationLinkDto> {
    return this.invitations.renew(admin.sub, id);
  }

  @Post(":id/revoke")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminInvitationResponseDto })
  revoke(@Param("id") id: string): Promise<AdminInvitationDto> {
    return this.invitations.revoke(id);
  }
}
