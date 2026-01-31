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
import { Role } from 'generated/prisma/enums';
import { CurrentUser, Roles } from 'src/common/decorators';
import { RolesGuard } from 'src/common/guards';
import { JwtAuthGuard } from '../auth/guards';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
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
    @CurrentUser() userId: string,
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
    @CurrentUser() userId: string,
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
    @CurrentUser() userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.filesService.findOne(id, userId, role);
  }

  /**
   * Department fayllarini olish
   * GET /files/department/:departmentId
   */
  @Get('department/:departmentId')
  async findByDepartment(
    @Param('departmentId') departmentId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('includeDeleted') includeDeleted: string = 'false',
    @CurrentUser() userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.filesService.findByDepartment(
      departmentId,
      userId,
      role,
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
    @CurrentUser() userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.filesService.remove(id, userId, role);
  }

  /**
   * O'chirilgan fayllarni ko'rish (admin only)
   * GET /files/deleted
   */
  @Get('admin/deleted')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getDeleted(
    @Query('departmentId') departmentId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @CurrentUser() userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.filesService.getDeleted(
      userId,
      role,
      departmentId,
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  /**
   * Faylni tiklash (admin only)
   * PATCH /files/:id/restore
   */
  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async restore(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.filesService.restore(id, userId, role);
  }

  /**
   * Faylni butunlay o'chirish (admin only)
   * DELETE /files/:id/permanent
   */
  @Delete(':id/permanent')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.filesService.permanentDelete(id, userId, role);
  }
}
