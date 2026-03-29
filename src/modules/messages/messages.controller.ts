import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SystemRole } from '../../../generated/prisma/client';
import { CurrentUser, SystemRoles } from '../../common/decorators';
import { SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import {
    CreateMessageWithFilesDto,
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
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max per file
    }),
  )
  @ApiOperation({
    summary: 'Send a message with optional files (atomic transaction)',
    description:
      'Xabar va fayllarni bitta atomic operatsiyada yuboradi. ' +
      'Agar biror qadam xato bo\'lsa, hammasi rollback qilinadi.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['companyId', 'globalDepartmentId'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Fayllar (max 10 ta, har biri max 15MB)',
        },
        companyId: {
          type: 'string',
          example: 'company-uuid',
        },
        globalDepartmentId: {
          type: 'string',
          example: 'dept-uuid',
        },
        content: {
          type: 'string',
          example: 'Salom, hammaga!',
          description: 'Xabar matni (ixtiyoriy agar fayl mavjud bo\'lsa)',
        },
        replyToId: {
          type: 'string',
          example: 'message-uuid',
          description: 'Reply qilish uchun xabar ID',
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
    description: 'Message sent with files',
    schema: {
      example: {
        id: 'cuid-message-id',
        content: 'Salom, hammaga!',
        type: 'FILE',
        status: 'SENT',
        createdAt: '2024-02-24T10:00:00.000Z',
        sender: { id: 'cuid', name: 'Ali Valiyev' },
        files: [
          {
            id: 'file-id',
            originalName: 'document.pdf',
            fileType: 'DOCUMENT',
            url: '/uploads/documents/uuid.pdf',
          },
        ],
      },
    },
  })
  async create(
    @Body() dto: CreateMessageWithFilesDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.createWithFiles(userId, systemRole, dto, files || []);
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

  }
