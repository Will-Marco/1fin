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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
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
  @ApiOperation({
    summary: 'Upload a single file',
    description:
      'Upload a file with optional messageId, documentId, or globalDepartmentId. Empty strings will be converted to null.',
  })
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
          description: 'Global department ID (optional)',
          nullable: true,
        },
        messageId: {
          type: 'string',
          example: 'message-uuid',
          description: 'Message ID (optional, message must exist)',
          nullable: true,
        },
        documentId: {
          type: 'string',
          example: 'document-uuid',
          description: 'Document ID (optional, document must exist)',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      example: {
        id: 'cuid-file-id',
        uploadedBy: 'user-id',
        globalDepartmentId: 'dept-id',
        messageId: null,
        documentId: null,
        originalName: 'document.pdf',
        fileName: 'uuid-document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        fileType: 'DOCUMENT',
        path: 'documents/uuid-document.pdf',
        isOutgoing: true,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        createdAt: '2024-02-24T10:00:00.000Z',
        updatedAt: '2024-02-24T10:00:00.000Z',
        uploader: {
          id: 'user-id',
          name: 'Ali Valiyev',
          username: 'ali.valiyev',
        },
        url: 'http://localhost:3000/uploads/documents/uuid-document.pdf',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'File too large or invalid file type',
    schema: {
      example: {
        statusCode: 400,
        message: 'Fayl hajmi 10MB dan oshmasligi kerak',
        error: 'Bad Request',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Referenced message/document/department not found',
    schema: {
      example: {
        statusCode: 404,
        message:
          'Message with ID abc-123 not found. Please create the message first or upload without messageId.',
        error: 'Not Found',
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
  @ApiOperation({
    summary: 'Upload multiple files (max 10)',
    description:
      'Upload up to 10 files at once. All files will be attached to the same message/document/department.',
  })
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
          maxItems: 10,
          description: 'Yuklanadigan fayllar (max 10 ta, har biri max 10MB)',
        },
        globalDepartmentId: {
          type: 'string',
          example: 'dept-uuid',
          description: 'Global department ID (optional)',
          nullable: true,
        },
        messageId: {
          type: 'string',
          example: 'message-uuid',
          description: 'Message ID (optional)',
          nullable: true,
        },
        documentId: {
          type: 'string',
          example: 'document-uuid',
          description: 'Document ID (optional)',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'All files uploaded successfully',
    schema: {
      example: [
        {
          id: 'file-1',
          originalName: 'doc1.pdf',
          fileName: 'uuid-doc1.pdf',
          fileSize: 1024000,
          fileType: 'DOCUMENT',
          uploader: { id: 'user-id', name: 'Ali', username: 'ali' },
          url: 'http://localhost:3000/uploads/documents/uuid-doc1.pdf',
        },
        {
          id: 'file-2',
          originalName: 'image.jpg',
          fileName: 'uuid-image.jpg',
          fileSize: 2048000,
          fileType: 'IMAGE',
          uploader: { id: 'user-id', name: 'Ali', username: 'ali' },
          url: 'http://localhost:3000/uploads/images/uuid-image.jpg',
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'File validation failed' })
  @ApiNotFoundResponse({ description: 'Referenced entity not found' })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.uploadMultiple(files, dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiParam({ name: 'id', description: 'File ID', example: 'cuid-file-id' })
  @ApiResponse({
    status: 200,
    description: 'File details with download URL',
    schema: {
      example: {
        id: 'cuid-file-id',
        uploadedBy: 'user-id',
        globalDepartmentId: 'dept-id',
        messageId: 'msg-id',
        documentId: null,
        originalName: 'document.pdf',
        fileName: 'uuid-document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        fileType: 'DOCUMENT',
        path: 'documents/uuid-document.pdf',
        isDeleted: false,
        deletedAt: null,
        createdAt: '2024-02-24T10:00:00.000Z',
        uploader: {
          id: 'user-id',
          name: 'Ali Valiyev',
          username: 'ali.valiyev',
        },
        url: 'http://localhost:3000/uploads/documents/uuid-document.pdf',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'File not found or deleted (non-admin users)',
    schema: {
      example: {
        statusCode: 404,
        message: 'Fayl topilmadi',
        error: 'Not Found',
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
  @ApiOperation({ summary: 'Get files by department with pagination' })
  @ApiParam({
    name: 'departmentId',
    description: 'Global Department ID',
    example: 'dept-uuid',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    example: false,
    description: 'Include deleted files (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of files in the department',
    schema: {
      example: {
        data: [
          {
            id: 'cuid',
            originalName: 'doc.pdf',
            fileSize: 1024000,
            fileType: 'DOCUMENT',
            uploader: { id: 'user-id', name: 'Ali', username: 'ali' },
            url: 'http://localhost:3000/uploads/documents/uuid.pdf',
          },
        ],
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
  @ApiOperation({
    summary: 'Delete file (soft delete)',
    description:
      'Soft delete a file. Only file uploader or admin can delete. File is not removed from storage.',
  })
  @ApiParam({ name: 'id', description: 'File ID', example: 'cuid-file-id' })
  @ApiResponse({
    status: 200,
    description: 'File soft deleted successfully',
    schema: { example: { message: "Fayl o'chirildi" } },
  })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiForbiddenResponse({
    description: 'User does not own the file and is not an admin',
    schema: {
      example: {
        statusCode: 403,
        message: "Ushbu faylni o'chirish huquqi yo'q",
        error: 'Forbidden',
      },
    },
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
  @ApiOperation({
    summary: 'Get deleted files (Admin only)',
    description:
      'Get paginated list of soft-deleted files. Only FIN_DIRECTOR and FIN_ADMIN can view deleted files.',
  })
  @ApiQuery({
    name: 'globalDepartmentId',
    required: false,
    description: 'Filter by department',
    example: 'dept-uuid',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of deleted files',
    schema: {
      example: {
        data: [
          {
            id: 'cuid',
            originalName: 'doc.pdf',
            fileSize: 1024000,
            isDeleted: true,
            deletedAt: '2024-02-24T10:00:00.000Z',
            deletedBy: 'user-id',
            uploader: { id: 'uploader-id', name: 'Ali', username: 'ali' },
            url: 'http://localhost:3000/uploads/documents/uuid.pdf',
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Only admin can view deleted files' })
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
  @ApiOperation({
    summary: 'Restore deleted file (Admin only)',
    description:
      'Restore a soft-deleted file. Only FIN_DIRECTOR and FIN_ADMIN can restore files.',
  })
  @ApiParam({ name: 'id', description: 'File ID', example: 'cuid-file-id' })
  @ApiResponse({
    status: 200,
    description: 'File restored successfully',
    schema: { example: { message: 'Fayl tiklandi' } },
  })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiBadRequestResponse({
    description: 'File is not deleted',
    schema: {
      example: {
        statusCode: 400,
        message: "Fayl o'chirilmagan",
        error: 'Bad Request',
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Only admin can restore files' })
  async restore(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.restore(id, userId, systemRole);
  }

  @Delete(':id/permanent')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({
    summary: 'Permanently delete file (Admin only)',
    description:
      'Permanently delete a file from both database and storage. This action cannot be undone. Only FIN_DIRECTOR and FIN_ADMIN can perform this action.',
  })
  @ApiParam({ name: 'id', description: 'File ID', example: 'cuid-file-id' })
  @ApiResponse({
    status: 200,
    description: 'File permanently deleted from database and storage',
    schema: { example: { message: "Fayl butunlay o'chirildi" } },
  })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiForbiddenResponse({
    description: 'Only admin can permanently delete files',
  })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.permanentDelete(id, userId, systemRole);
  }

  @Patch(':fileId/attach/:messageId')
  @ApiOperation({
    summary: 'Attach file to message after upload',
    description:
      'Attach a previously uploaded file to a message. User must own both the file and the message.',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID to attach',
    example: 'cuid-file-id',
  })
  @ApiParam({
    name: 'messageId',
    description: 'Message ID to attach to',
    example: 'cuid-message-id',
  })
  @ApiResponse({
    status: 200,
    description: 'File successfully attached to message',
    schema: {
      example: {
        id: 'cuid-file-id',
        uploadedBy: 'user-id',
        globalDepartmentId: 'dept-id',
        messageId: 'cuid-message-id',
        documentId: null,
        originalName: 'document.pdf',
        fileName: 'uuid-document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        fileType: 'DOCUMENT',
        path: 'documents/uuid-document.pdf',
        isOutgoing: true,
        isDeleted: false,
        createdAt: '2024-02-24T10:00:00.000Z',
        updatedAt: '2024-02-24T10:00:00.000Z',
        uploader: {
          id: 'user-id',
          name: 'Ali Valiyev',
          username: 'ali.valiyev',
        },
        url: 'http://localhost:3000/uploads/documents/uuid-document.pdf',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'File or message not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Fayl topilmadi',
        error: 'Not Found',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'User does not own the file or message',
    schema: {
      example: {
        statusCode: 403,
        message: "Siz faqat o'zingiz yuklagan fayllarni biriktira olasiz",
        error: 'Forbidden',
      },
    },
  })
  async attachToMessage(
    @Param('fileId') fileId: string,
    @Param('messageId') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.attachToMessage(fileId, messageId, userId);
  }

  @Patch('attach-multiple/:messageId')
  @ApiOperation({
    summary: 'Attach multiple files to message',
    description:
      'Attach multiple previously uploaded files to a single message. User must own all files and the message.',
  })
  @ApiParam({
    name: 'messageId',
    description: 'Message ID to attach files to',
    example: 'cuid-message-id',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileIds'],
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          example: ['file-id-1', 'file-id-2', 'file-id-3'],
          description: 'Array of file IDs to attach',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'All files successfully attached to message',
    schema: {
      example: [
        {
          id: 'file-1',
          messageId: 'msg-1',
          originalName: 'doc1.pdf',
          uploader: { id: 'user-id', name: 'Ali', username: 'ali' },
          url: 'http://localhost:3000/uploads/documents/uuid-doc1.pdf',
        },
        {
          id: 'file-2',
          messageId: 'msg-1',
          originalName: 'doc2.pdf',
          uploader: { id: 'user-id', name: 'Ali', username: 'ali' },
          url: 'http://localhost:3000/uploads/documents/uuid-doc2.pdf',
        },
      ],
    },
  })
  @ApiNotFoundResponse({ description: 'File or message not found' })
  @ApiForbiddenResponse({
    description: 'User does not own one or more files or the message',
  })
  async attachMultipleToMessage(
    @Param('messageId') messageId: string,
    @Body('fileIds') fileIds: string[],
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.attachMultipleToMessage(
      fileIds,
      messageId,
      userId,
    );
  }
}
