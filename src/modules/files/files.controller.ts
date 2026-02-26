import {
    Body,
    Controller,
    Delete,
    Get,
    MaxFileSizeValidator,
    Param,
    ParseFilePipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '../../../generated/prisma/client';
import { CurrentUser, SystemRoles } from '../../common/decorators';
import { SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Yuklanadigan fayl (max 10MB)',
        },
        globalDepartmentId: {
          type: 'string',
          example: 'dept-uuid',
          description: 'Global department ID',
        },
        messageId: {
          type: 'string',
          example: 'message-uuid',
          description: 'Message ID',
        },
        documentId: {
          type: 'string',
          example: 'document-uuid',
          description: 'Document ID',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded',
    schema: {
      example: {
        id: 'cuid-file-id',
        originalName: 'document.pdf',
        fileName: 'uuid-document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        fileType: 'DOCUMENT',
        path: '/uploads/files/uuid-document.pdf',
        createdAt: '2024-02-24T10:00:00.000Z',
      },
    },
  })
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB max
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.upload(file, dto, userId);
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Yuklanadigan fayllar (max 10 ta, har biri max 10MB)',
        },
        globalDepartmentId: {
          type: 'string',
          example: 'dept-uuid',
          description: 'Global department ID',
        },
        messageId: {
          type: 'string',
          example: 'message-uuid',
          description: 'Message ID',
        },
        documentId: {
          type: 'string',
          example: 'document-uuid',
          description: 'Document ID',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded',
    schema: {
      example: [
        { id: 'cuid', originalName: 'doc1.pdf', fileName: 'uuid-doc1.pdf', fileSize: 1024000 },
        { id: 'cuid', originalName: 'doc2.pdf', fileName: 'uuid-doc2.pdf', fileSize: 2048000 },
      ],
    },
  })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.uploadMultiple(files, dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiResponse({
    status: 200,
    description: 'File details',
    schema: {
      example: {
        id: 'cuid-file-id',
        originalName: 'document.pdf',
        fileName: 'uuid-document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        fileType: 'DOCUMENT',
        path: '/uploads/files/uuid-document.pdf',
        isDeleted: false,
        createdAt: '2024-02-24T10:00:00.000Z',
      },
    },
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.findOne(id, userId, systemRole);
  }

  @Get('department/:departmentId')
  @ApiOperation({ summary: 'Get files by department' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of files',
    schema: {
      example: {
        data: [{ id: 'cuid', originalName: 'doc.pdf', fileSize: 1024000 }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  async findByDepartment(
    @Param('departmentId') globalDepartmentId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('includeDeleted') includeDeleted: string = 'false',
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.findByDepartment(
      globalDepartmentId,
      userId,
      systemRole,
      parseInt(page) || 1,
      parseInt(limit) || 20,
      includeDeleted === 'true',
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete file (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'File deleted',
    schema: { example: { message: "Fayl o'chirildi" } },
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.remove(id, userId, systemRole);
  }

  @Get('admin/deleted')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Get deleted files (Admin only)' })
  @ApiQuery({ name: 'globalDepartmentId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of deleted files',
    schema: {
      example: {
        data: [{ id: 'cuid', originalName: 'doc.pdf', deletedAt: '2024-02-24T10:00:00.000Z' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  async getDeleted(
    @Query('globalDepartmentId') globalDepartmentId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.getDeleted(
      userId,
      systemRole,
      globalDepartmentId,
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  @Patch(':id/restore')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Restore deleted file (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'File restored',
    schema: { example: { message: 'Fayl tiklandi' } },
  })
  async restore(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.restore(id, userId, systemRole);
  }

  @Delete(':id/permanent')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Permanently delete file (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'File permanently deleted',
    schema: { example: { message: "Fayl butunlay o'chirildi" } },
  })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.permanentDelete(id, userId, systemRole);
  }
}
