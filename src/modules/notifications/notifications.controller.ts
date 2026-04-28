import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards';
import {
  CurrentUser,
  ThrottleRead,
  ThrottleWrite,
} from '../../common/decorators';
import { RegisterDeviceTokenDto } from './dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ThrottleRead()
  @ApiOperation({ summary: 'Get all notifications for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    schema: {
      example: {
        data: [
          {
            id: 'cuid-notification-id',
            title: 'Yangi xabar',
            body: 'Sizga yangi xabar keldi',
            data: { messageId: 'cuid' },
            isRead: false,
            createdAt: '2024-02-24T10:00:00.000Z',
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findAll(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('unread-count')
  @ThrottleRead()
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count',
    schema: { example: { count: 5 } },
  })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @ThrottleWrite()
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: {
      example: {
        id: 'cuid-notification-id',
        isRead: true,
        readAt: '2024-02-24T12:00:00.000Z',
      },
    },
  })
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @ThrottleWrite()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      example: {
        message: "Barcha bildirishnomalar o'qilgan deb belgilandi",
        count: 5,
      },
    },
  })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ThrottleWrite()
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted',
    schema: { example: { message: "Bildirishnoma o'chirildi" } },
  })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.delete(id, userId);
  }

  @Delete()
  @ThrottleWrite()
  @ApiOperation({ summary: 'Delete all notifications' })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted',
    schema: {
      example: { message: "Barcha bildirishnomalar o'chirildi", count: 10 },
    },
  })
  async deleteAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.deleteAll(userId);
  }

  @Post('devices')
  @ThrottleWrite()
  @ApiOperation({
    summary: 'Register OneSignal player ID for the current device',
    description:
      'Frontend calls this after OneSignal SDK initializes, passing the current ' +
      'playerId. Upsert: if the playerId already belongs to another user (same ' +
      'physical device reused), it is reassigned to the current user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Device token registered',
    schema: {
      example: {
        id: 'cuid-device-token-id',
        playerId: '11e5c1e2-2f4b-4db1-9351-0139a0b2a193',
        platform: 'WEB',
        isActive: true,
        lastSeenAt: '2026-04-24T10:00:00.000Z',
      },
    },
  })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(
      userId,
      dto.playerId,
      dto.platform,
    );
  }

  @Delete('devices/:playerId')
  @ThrottleWrite()
  @ApiOperation({
    summary: 'Unregister a device (e.g. on logout)',
    description:
      'Deactivates the device token tied to the current user and the given playerId. ' +
      'Scoped by userId — will not affect a token that was reassigned to another user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Device unregistered',
    schema: { example: { unregistered: 1 } },
  })
  async unregisterDevice(
    @CurrentUser('id') userId: string,
    @Param('playerId') playerId: string,
  ) {
    return this.notificationsService.unregisterDeviceToken(userId, playerId);
  }
}
