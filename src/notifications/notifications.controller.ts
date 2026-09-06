import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { UnreadCountResponseDto } from 'src/workspaces/dto/unread-count-response.dto';
import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { NotificationListResponseDto } from './dto/notification-list-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiAuth()
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOkResponse({ type: NotificationListResponseDto })
  @Get()
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.findMine(user.id, pagination);
  }

  @ApiOkResponse({ type: UnreadCountResponseDto })
  @Post('read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkNotificationsReadDto,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.markRead(user.id, dto);
  }

  @ApiOkResponse({ type: UnreadCountResponseDto })
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser): Promise<UnreadCountResponseDto> {
    return this.notificationsService.markAllRead(user.id);
  }
}
