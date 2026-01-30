import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import {
  CreateMessageDto,
  UpdateMessageDto,
  ForwardMessageDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../../generated/prisma/client';

@ApiTags('Messages')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('departments/:departmentId/messages')
  @ApiOperation({ summary: 'Send a message to department' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async create(
    @Param('departmentId') departmentId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.messagesService.create(departmentId, dto, userId, userRole);
  }

  @Post('departments/:departmentId/messages/voice')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/voice',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `voice-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Send a voice message' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Voice message sent' })
  async createVoiceMessage(
    @Param('departmentId') departmentId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /audio\/(mpeg|mp4|ogg|webm|wav)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('voiceDuration') voiceDuration: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    const dto: CreateMessageDto = {
      type: 'VOICE' as any,
      voiceDuration: parseInt(voiceDuration, 10),
      content: file.path,
    };
    return this.messagesService.create(departmentId, dto, userId, userRole);
  }

  @Get('departments/:departmentId/messages')
  @ApiOperation({ summary: 'Get messages from department' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('departmentId') departmentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: Role,
  ) {
    return this.messagesService.findAll(
      departmentId,
      userId!,
      userRole!,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get a message by ID' })
  @ApiResponse({ status: 200, description: 'Message details' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.messagesService.findOne(id, userId, userRole);
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit a message' })
  @ApiResponse({ status: 200, description: 'Message updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.messagesService.update(id, dto, userId, userRole);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete a message' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.messagesService.remove(id, userId, userRole);
  }

  @Post('messages/:id/forward')
  @ApiOperation({ summary: 'Forward a message to another department' })
  @ApiResponse({ status: 201, description: 'Message forwarded' })
  async forward(
    @Param('id') id: string,
    @Body() dto: ForwardMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.messagesService.forward(id, dto, userId, userRole);
  }

  @Get('messages/:id/history')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get message edit history (Admin only)' })
  @ApiResponse({ status: 200, description: 'Edit history' })
  async getEditHistory(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.messagesService.getEditHistory(id, userId, userRole);
  }

  @Get('departments/:departmentId/deleted-messages')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get deleted messages (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of deleted messages' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getDeletedMessages(
    @Param('departmentId') departmentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: Role,
  ) {
    return this.messagesService.getDeletedMessages(
      departmentId,
      userId!,
      userRole!,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
