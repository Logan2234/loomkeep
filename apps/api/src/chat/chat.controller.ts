import type {
  ChatUnreadDto,
  ConversationDto,
  MessageDto,
  PagedResult,
  RecommendWorkResultDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { UserSummaryResponseDto } from "../common/dto/user-summary-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import {
  CHAT_MESSAGE_THROTTLE,
  REPORT_THROTTLE,
} from "../common/throttle.constants";
import { CreateReportBody } from "../reports/dto/create-report.dto";
import { ReportService } from "../reports/report.service";
import { ChatFeatureGuard } from "./chat-feature.guard";
import { ChatWorkService } from "./chat-work.service";
import {
  CONVERSATION_PAGE_SIZE,
  ChatService,
  MESSAGE_PAGE_SIZE,
} from "./chat.service";
import {
  EditMessageBody,
  MuteConversationBody,
  OpenConversationBody,
  ReactMessageBody,
  RecommendWorkBody,
  SendMessageBody,
} from "./dto/chat-request.dto";
import {
  ChatUnreadResponseDto,
  ConversationResponseDto,
  MessageResponseDto,
  RecommendWorkResultResponseDto,
} from "./dto/chat-response.dto";

@UseGuards(ChatFeatureGuard)
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly works: ChatWorkService,
    private readonly reports: ReportService,
  ) {}

  @Get("conversations")
  @ApiOkResponse({ type: PagedResponseDto(ConversationResponseDto) })
  list(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<ConversationDto>> {
    return this.chat.list(
      user.sub,
      parsePageQuery(page, limit, CONVERSATION_PAGE_SIZE),
    );
  }

  /** Finds, or starts, the conversation with a friend. */
  @Post("conversations")
  @ApiCreatedResponse({ type: ConversationResponseDto })
  open(
    @CurrentUser() user: JwtPayload,
    @Body() body: OpenConversationBody,
  ): Promise<ConversationDto> {
    return this.chat.open(user.sub, body.username);
  }

  @Get("conversations/:id")
  @ApiOkResponse({ type: ConversationResponseDto })
  get(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ConversationDto> {
    return this.chat.get(user.sub, id);
  }

  /** Newest first. */
  @Get("conversations/:id/messages")
  @ApiOkResponse({ type: PagedResponseDto(MessageResponseDto) })
  messages(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<MessageDto>> {
    return this.chat.messages(
      user.sub,
      id,
      parsePageQuery(page, limit, MESSAGE_PAGE_SIZE),
    );
  }

  @Throttle(CHAT_MESSAGE_THROTTLE)
  @Post("conversations/:id/messages")
  @ApiCreatedResponse({ type: MessageResponseDto })
  async send(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: SendMessageBody,
  ): Promise<MessageDto> {
    const work = body.work ? await this.works.required(body.work) : null;
    const text = body.text?.trim() ? body.text : null;
    const message = await this.chat.send(
      user.sub,
      id,
      text,
      body.spoiler,
      work,
    );

    if (text) this.works.refreshLinkedWorks(message.id, text, body.skipLinks);

    return message;
  }

  /** "Recommander": the work goes to each friend, in their own conversation. */
  @Throttle(CHAT_MESSAGE_THROTTLE)
  @Post("recommendations")
  @ApiCreatedResponse({ type: RecommendWorkResultResponseDto })
  async recommend(
    @CurrentUser() user: JwtPayload,
    @Body() body: RecommendWorkBody,
  ): Promise<RecommendWorkResultDto> {
    const work = await this.works.required(body.work);
    const text = body.text?.trim() ? body.text : null;
    return {
      sent: await this.chat.recommend(user.sub, body.usernames, text, work),
    };
  }

  @Post("conversations/:id/read")
  read(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.chat.markRead(user.sub, id);
  }

  @Put("conversations/:id/mute")
  mute(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: MuteConversationBody,
  ): Promise<void> {
    return this.chat.mute(user.sub, id, body.muted);
  }

  /** Friends to start a conversation with. */
  @Get("friends")
  @ApiOkResponse({ type: UserSummaryResponseDto, isArray: true })
  friends(
    @CurrentUser() user: JwtPayload,
    @Query("q") query?: string,
  ): Promise<UserSummaryDto[]> {
    return this.chat.friends(user.sub, query);
  }

  @Get("unread")
  @ApiOkResponse({ type: ChatUnreadResponseDto })
  async unread(@CurrentUser() user: JwtPayload): Promise<ChatUnreadDto> {
    return { count: await this.chat.unreadTotal(user.sub) };
  }

  @Put("messages/:id")
  @ApiOkResponse({ type: MessageResponseDto })
  async edit(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: EditMessageBody,
  ): Promise<MessageDto> {
    const message = await this.chat.edit(user.sub, id, body.text, body.spoiler);
    this.works.refreshLinkedWorks(message.id, body.text, body.skipLinks);
    return message;
  }

  @Delete("messages/:id")
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.chat.remove(user.sub, id);
  }

  @Put("messages/:id/reaction")
  react(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ReactMessageBody,
  ): Promise<void> {
    return this.chat.react(user.sub, id, body.emote);
  }

  @Delete("messages/:id/reaction")
  unreact(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.chat.unreact(user.sub, id);
  }

  @Post("messages/:id/report")
  @Throttle(REPORT_THROTTLE)
  async report(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: CreateReportBody,
  ): Promise<void> {
    await this.chat.ensureReportable(user.sub, id);
    await this.reports.create(
      user.sub,
      "MESSAGE",
      id,
      body.category,
      body.motif,
      body.reason,
    );
  }
}
