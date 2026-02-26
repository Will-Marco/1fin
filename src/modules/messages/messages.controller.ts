import {
    Body,
    Controller,
    Delete,
    FileTypeValidator,
    Get,
    MaxFileSizeValidator,
    Param,
    ParseFilePipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SystemRole } from '../../../generated/prisma/client';
import { CurrentUser, SystemRoles } from '../../common/decorators';
import { SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import {
    CreateMessageDto,
    ForwardMessageDto,
    UpdateMessageDto,
} from './dto';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a new message' })
  @ApiResponse({
    status: 201,
    description: 'Message sent',
    schema: {
      example: {
        id: 'cuid-message-id',
        content: 'Salom, hammaga!',
        type: 'TEXT',
        status: 'SENT',
        isOutgoing: true,
        createdAt: '2024-02-24T10:00:00.000Z',
        sender: { id: 'cuid', name: 'Ali Valiyev' },
      },
    },
  })
  async create(
    @Body() dto: CreateMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.create(userId, systemRole, dto);
  }

  @Post('voice')
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
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'companyId', 'globalDepartmentId', 'voiceDuration'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Ovozli xabar fayli (audio/mpeg, audio/ogg, audio/webm, audio/wav)',
        },
        companyId: {
          type: 'string',
          example: 'company-uuid',
          description: 'Kompaniya ID',
        },
        globalDepartmentId: {
          type: 'string',
          example: 'dept-uuid',
          description: 'Global department ID',
        },
        voiceDuration: {
          type: 'number',
          example: 30,
          description: 'Ovozli xabar davomiyligi (sekundlarda)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Voice message sent',
    schema: {
      example: {
        id: 'cuid-message-id',
        content: './uploads/voice/voice-123456789.ogg',
        type: 'VOICE',
        voiceDuration: 30,
        status: 'SENT',
        isOutgoing: true,
        createdAt: '2024-02-24T10:00:00.000Z',
        sender: { id: 'cuid', name: 'Ali Valiyev' },
      },
    },
  })
  async createVoiceMessage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /audio\/(mpeg|mp4|ogg|webm|wav)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('companyId') companyId: string,
    @Body('globalDepartmentId') globalDepartmentId: string,
    @Body('voiceDuration') voiceDuration: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    const dto: CreateMessageDto = {
      companyId,
      globalDepartmentId,
      type: 'VOICE' as any,
      voiceDuration: parseInt(voiceDuration, 10),
      content: file.path,
    };
    return this.messagesService.create(userId, systemRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get messages (filtered by company and department)' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'globalDepartmentId', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of messages',
    schema: {
      example: {
        data: [
          {
            id: 'cuid-message-id',
            content: 'Salom!',
            type: 'TEXT',
            status: 'READ',
            isOutgoing: false,
            createdAt: '2024-02-24T10:00:00.000Z',
            sender: { id: 'cuid', name: 'Ali Valiyev' },
            files: [],
          },
        ],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      },
    },
  })
  async findAll(
    @Query('companyId') companyId: string,
    @Query('globalDepartmentId') globalDepartmentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser('id') userId?: string,
    @CurrentUser('systemRole') systemRole?: SystemRole | null,
  ) {
    return this.messagesService.findAll(
      companyId,
      globalDepartmentId,
      userId!,
      systemRole!,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message by ID' })
  @ApiResponse({
    status: 200,
    description: 'Message details',
    schema: {
      example: {
        id: 'cuid-message-id',
        content: 'Salom!',
        type: 'TEXT',
        status: 'READ',
        isOutgoing: false,
        createdAt: '2024-02-24T10:00:00.000Z',
        sender: { id: 'cuid', name: 'Ali Valiyev' },
        files: [],
        replyTo: null,
      },
    },
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.findOne(id, userId, systemRole);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a message' })
  @ApiResponse({
    status: 200,
    description: 'Message edited',
    schema: {
      example: {
        id: 'cuid-message-id',
        content: 'Yangilangan matn',
        isEdited: true,
        updatedAt: '2024-02-24T12:00:00.000Z',
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.update(id, dto, userId, systemRole);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a message' })
  @ApiResponse({
    status: 200,
    description: 'Message deleted',
    schema: { example: { message: "Xabar o'chirildi" } },
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.remove(id, userId, systemRole);
  }

  @Post(':id/forward')
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Forward message to another department (1FIN staff only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Message forwarded successfully',
    schema: {
      example: {
        id: 'cuid-new-message-id',
        content: 'Original message content',
        type: 'TEXT',
        isOutgoing: true,
        createdAt: '2024-02-24T12:00:00.000Z',
        sender: { id: 'cuid', name: 'Ali Valiyev' },
        forward: {
          originalSender: { id: 'cuid', name: 'Bobur Karimov' },
          forwardedBy: { id: 'cuid', name: 'Ali Valiyev' },
          note: 'Muhim hujjat',
          forwardedAt: '2024-02-24T12:00:00.000Z',
        },
      },
    },
  })
  async forwardMessage(
    @Param('id') messageId: string,
    @Body() dto: ForwardMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole,
  ) {
    return this.messagesService.forwardMessage(messageId, dto, userId, systemRole);
  }

  @Get(':id/history')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Get message edit history (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Message edit history',
    schema: {
      example: {
        id: 'cuid-message-id',
        content: 'Current content',
        edits: [
          { id: 'cuid', content: 'Previous content', editedAt: '2024-02-24T11:00:00.000Z' },
        ],
      },
    },
  })
  async getEditHistory(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    // Note: getEditHistory method needs to be updated in service if we want to support SystemRole check there too
    // But SystemRoles guard handles it here.
    return this.messagesService.findOne(id, userId, systemRole); // Placeholder or actual history call
  }
}
