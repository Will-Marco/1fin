import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
import { DocumentsService } from './documents.service';
import { RejectDocumentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, DocumentStatus } from '../../../generated/prisma/client';

@ApiTags('Documents')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('documents/:id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FOUNDER, Role.DIRECTOR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Approve a document' })
  @ApiResponse({ status: 200, description: 'Document approved' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.documentsService.approve(id, userId, userRole);
  }

  @Post('documents/:id/reject')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FOUNDER, Role.DIRECTOR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Reject a document' })
  @ApiResponse({ status: 200, description: 'Document rejected' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.documentsService.reject(id, dto, userId, userRole);
  }

  @Get('companies/:companyId/documents/pending')
  @ApiOperation({ summary: 'Get pending documents for a company' })
  @ApiResponse({ status: 200, description: 'List of pending documents' })
  async getPending(
    @Param('companyId') companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.documentsService.getPending(companyId, userId, userRole);
  }

  @Get('companies/:companyId/documents')
  @ApiOperation({ summary: 'Get all documents for a company' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiQuery({ name: 'status', required: false, enum: DocumentStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAll(
    @Param('companyId') companyId: string,
    @Query('status') status?: DocumentStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: Role,
  ) {
    return this.documentsService.getAll(
      companyId,
      userId!,
      userRole!,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
