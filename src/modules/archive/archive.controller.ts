import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '../../../generated/prisma/client';
import { SystemRoles } from '../../common/decorators';
import { SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import { ArchiveService } from './archive.service';
import {
    SearchDocumentsArchiveDto,
    SearchFilesArchiveDto,
    SearchMessagesArchiveDto,
} from './dto';

@ApiTags('Archive')
@Controller('archive')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('messages')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Search archived messages' })
  @ApiResponse({ status: 200, description: 'Archived messages list' })
  async searchMessages(@Query() dto: SearchMessagesArchiveDto) {
    return this.archiveService.searchMessages({
      globalDepartmentId: dto.globalDepartmentId,
      companyId: dto.companyId,
      senderId: dto.senderId,
      content: dto.content,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Get('files')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Search archived files' })
  @ApiResponse({ status: 200, description: 'Archived files list' })
  async searchFiles(@Query() dto: SearchFilesArchiveDto) {
    return this.archiveService.searchFiles({
      globalDepartmentId: dto.globalDepartmentId,
      fileName: dto.fileName,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Get('documents')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Search archived documents' })
  @ApiResponse({ status: 200, description: 'Archived documents list' })
  async searchDocuments(@Query() dto: SearchDocumentsArchiveDto) {
    return this.archiveService.searchDocuments({
      globalDepartmentId: dto.globalDepartmentId,
      companyId: dto.companyId,
      documentNumber: dto.documentNumber,
      documentName: dto.documentName,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Get('statistics')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Get archive statistics' })
  @ApiResponse({ status: 200, description: 'Archive statistics' })
  async getStatistics() {
    return this.archiveService.getStatistics();
  }

  @Post('run')
  @SystemRoles(SystemRole.FIN_DIRECTOR)
  @ApiOperation({ summary: 'Manually trigger archive process (FIN_DIRECTOR only)' })
  @ApiResponse({ status: 200, description: 'Archive result' })
  async runArchive() {
    const archiveResult = await this.archiveService.archiveOldData();
    const orphanFilesCount = await this.archiveService.archiveOrphanFiles();

    return {
      ...archiveResult,
      orphanFilesArchived: orphanFilesCount,
    };
  }
}
