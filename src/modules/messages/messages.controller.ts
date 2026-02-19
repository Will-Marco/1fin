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
    UpdateMessageDto
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
  @ApiResponse({ status: 201, description: 'Message sent' })
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
  @ApiResponse({ status: 201, description: 'Voice message sent' })
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
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.findOne(id, userId, systemRole);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a message' })
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
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.messagesService.remove(id, userId, systemRole);
  }

  @Get(':id/history')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Get message edit history (Admin only)' })
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
