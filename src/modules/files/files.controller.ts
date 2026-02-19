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
import { SystemRole } from '../../../generated/prisma/client';
import { CurrentUser, SystemRoles } from '../../common/decorators';
import { SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Bitta fayl yuklash
   * POST /files/upload
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
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

  /**
   * Bir nechta fayl yuklash
   * POST /files/upload-multiple
   */
  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10)) // max 10 ta fayl
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.uploadMultiple(files, dto, userId);
  }

  /**
   * Faylni olish
   * GET /files/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.findOne(id, userId, systemRole);
  }

  /**
   * Department fayllarini olish
   * GET /files/department/:departmentId
   */
  @Get('department/:departmentId')
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

  /**
   * Faylni o'chirish (soft delete)
   * DELETE /files/:id
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.remove(id, userId, systemRole);
  }

  /**
   * O'chirilgan fayllarni ko'rish (admin only)
   * GET /files/deleted
   */
  @Get('admin/deleted')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
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

  /**
   * Faylni tiklash (admin only)
   * PATCH /files/:id/restore
   */
  @Patch(':id/restore')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  async restore(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.restore(id, userId, systemRole);
  }

  /**
   * Faylni butunlay o'chirish (admin only)
   * DELETE /files/:id/permanent
   */
  @Delete(':id/permanent')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole | null,
  ) {
    return this.filesService.permanentDelete(id, userId, systemRole);
  }
}
