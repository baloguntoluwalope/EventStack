import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the current user' })
  list(@CurrentUser() user: { userId: string }, @Query('unread') unread?: string) {
    return this.notificationsService.listForUser(user.userId, unread === 'true');
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}