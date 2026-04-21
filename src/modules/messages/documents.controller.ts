import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentStatus, SystemRole } from '../../../generated/prisma/client';
import {
  CurrentUser,
  SystemRoles,
  ThrottleRead,
  ThrottleWrite,
} from '../../common/decorators';
import { DocumentPermissionGuard, SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, RejectDocumentDto } from './dto';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post()
  @ThrottleWrite()
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Create a new document' })
  @ApiResponse({ status: 201, description: 'Document created' })
  async create(
    @Body() dto: CreateDocumentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.create(userId, dto);
  }

  @Get()
  @ThrottleRead()
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Get all documents (paginated/filtered)' })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'globalDepartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: DocumentStatus })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('companyId') companyId?: string,
    @Query('globalDepartmentId') globalDepartmentId?: string,
    @Query('status') status?: DocumentStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      { companyId, globalDepartmentId, status, search },
    );
  }

  @Get(':id')
  @ThrottleRead()
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({ status: 200, description: 'Document details' })
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch(':id/approve')
  @ThrottleWrite()
  @UseGuards(DocumentPermissionGuard)
  @ApiOperation({
    summary: 'Approve a document (ACCEPTED status)',
    description:
      'FIN_* and CLIENT_DIRECTOR/CLIENT_EMPLOYEE can approve. ' +
      'CLIENT_FOUNDER cannot (monitoring only). ' +
      'Bank Oplata documents cannot be approved/rejected.',
  })
  @ApiResponse({ status: 200, description: 'Document approved' })
  @ApiResponse({ status: 403, description: 'No permission' })
  async approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @ThrottleWrite()
  @UseGuards(DocumentPermissionGuard)
  @ApiOperation({
    summary: 'Reject a document (REJECTED status)',
    description:
      'FIN_* and CLIENT_DIRECTOR/CLIENT_EMPLOYEE can reject. ' +
      'CLIENT_FOUNDER cannot. ' +
      'Xatlar department: clients cannot reject (only approve/Tanishdim).',
  })
  @ApiResponse({ status: 200, description: 'Document rejected' })
  @ApiResponse({ status: 403, description: 'No permission' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.reject(id, userId, dto);
  }
}
