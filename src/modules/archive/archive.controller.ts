import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ArchiveService } from './archive.service';
import {
  SearchMessagesArchiveDto,
  SearchFilesArchiveDto,
  SearchDocumentApprovalsArchiveDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { Role } from '../../../generated/prisma/client';

@ApiTags('Archive')
@Controller('archive')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('messages')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Search archived messages' })
  @ApiResponse({ status: 200, description: 'Archived messages list' })
  async searchMessages(@Query() dto: SearchMessagesArchiveDto) {
    return this.archiveService.searchMessages({
      departmentId: dto.departmentId,
      senderId: dto.senderId,
      content: dto.content,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Get('files')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Search archived files' })
  @ApiResponse({ status: 200, description: 'Archived files list' })
  async searchFiles(@Query() dto: SearchFilesArchiveDto) {
    return this.archiveService.searchFiles({
      departmentId: dto.departmentId,
      fileName: dto.fileName,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Get('document-approvals')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Search archived document approvals' })
  @ApiResponse({ status: 200, description: 'Archived document approvals list' })
  async searchDocumentApprovals(@Query() dto: SearchDocumentApprovalsArchiveDto) {
    return this.archiveService.searchDocumentApprovals({
      documentNumber: dto.documentNumber,
      documentName: dto.documentName,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Get('statistics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get archive statistics' })
  @ApiResponse({ status: 200, description: 'Archive statistics' })
  async getStatistics() {
    return this.archiveService.getStatistics();
  }

  @Post('run')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually trigger archive process (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Archive result' })
  async runArchive() {
    const messageResult = await this.archiveService.archiveOldMessages();
    const orphanFilesCount = await this.archiveService.archiveOrphanFiles();

    return {
      ...messageResult,
      orphanFilesArchived: orphanFilesCount,
    };
  }
}
