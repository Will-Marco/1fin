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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';

@ApiTags('Companies')
@Controller('companies')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  // ─────────────────────────────────────────────
  // DELETED COMPANIES MANAGEMENT (Admin only)
  // ─────────────────────────────────────────────

  @Get('admin/deleted')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Get all soft-deleted companies (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of deleted companies',
    schema: {
      example: {
        data: [
          {
            id: 'cuid-company-id',
            name: 'O\'chirilgan kompaniya',
            inn: '123456789',
            logo: null,
            address: 'Toshkent',
            isActive: false,
            createdAt: '2024-02-24T10:00:00.000Z',
            updatedAt: '2024-02-25T10:00:00.000Z',
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  async findAllDeleted(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.companiesService.findAllDeleted(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  @Patch('admin/:id/restore')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Restore a soft-deleted company (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Company restored',
    schema: {
      example: {
        id: 'cuid-company-id',
        name: 'Tiklangan kompaniya',
        inn: '123456789',
        isActive: true,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 409, description: 'Company is already active' })
  async restore(@Param('id') id: string) {
    return this.companiesService.restore(id);
  }

  @Delete('admin/:id/permanent')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a company (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Company permanently deleted',
    schema: { example: { message: "Kompaniya butunlay o'chirildi" } },
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 409, description: 'Only deleted companies can be permanently removed' })
  async permanentDelete(@Param('id') id: string) {
    return this.companiesService.permanentDelete(id);
  }

  // ─────────────────────────────────────────────
  // COMPANY CRUD
  // ─────────────────────────────────────────────

  @Post()
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Create a new company (auto-links all global departments)' })
  @ApiResponse({
    status: 201,
    description: 'Company created',
    schema: {
      example: {
        id: 'cuid-company-id',
        name: 'Example LLC',
        description: 'IT xizmatlari',
        inn: '123456789',
        logo: null,
        address: 'Toshkent, Chilonzor',
        requisites: { bank: 'NBU', mfo: '00123' },
        requisites2: null,
        isActive: true,
        createdAt: '2024-02-24T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'INN already exists' })
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.companiesService.create(dto, userId);
  }

  @Get()
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get all companies (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of companies',
    schema: {
      example: {
        data: [
          {
            id: 'cuid-company-id',
            name: 'Example LLC',
            inn: '123456789',
            logo: null,
            address: 'Toshkent',
            isActive: true,
            createdAt: '2024-02-24T10:00:00.000Z',
            _count: { memberships: 5, departmentConfigs: 3 },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.companiesService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  @Get(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get company by ID (with department configs)' })
  @ApiResponse({
    status: 200,
    description: 'Company details',
    schema: {
      example: {
        id: 'cuid-company-id',
        name: 'Example LLC',
        inn: '123456789',
        logo: null,
        address: 'Toshkent',
        requisites: { bank: 'NBU', mfo: '00123' },
        requisites2: null,
        isActive: true,
        departmentConfigs: [
          { id: 'cuid', isEnabled: true, globalDepartment: { id: 'cuid', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        ],
        _count: { memberships: 5 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Update company info' })
  @ApiResponse({
    status: 200,
    description: 'Company updated',
    schema: {
      example: {
        id: 'cuid-company-id',
        name: 'Example LLC (yangilangan)',
        inn: '123456789',
        isActive: true,
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Deactivate company (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Company deactivated',
    schema: { example: { message: "Kompaniya o'chirildi" } },
  })
  async remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  @Patch(':id/logo')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Upload company logo' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded',
    schema: {
      example: {
        id: 'cuid-company-id',
        name: 'Example LLC',
        logo: '/uploads/logos/1234567890-123456789.png',
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.companiesService.updateLogo(id, `/uploads/logos/${file.filename}`);
  }

  // ─────────────────────────────────────────────
  // DEPARTMENT CONFIG
  // ─────────────────────────────────────────────

  @Get(':id/departments')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get all department configs for a company' })
  @ApiResponse({
    status: 200,
    description: 'List of department configs',
    schema: {
      example: [
        { id: 'cuid', isEnabled: true, globalDepartment: { id: 'cuid', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        { id: 'cuid', isEnabled: false, globalDepartment: { id: 'cuid', name: 'Yuridik', slug: 'yuridik' } },
      ],
    },
  })
  async getDepartmentConfigs(@Param('id') id: string) {
    return this.companiesService.getDepartmentConfigs(id);
  }

  @Post(':id/departments/:deptId/enable')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Enable a global department for this company' })
  @ApiResponse({
    status: 200,
    description: 'Department enabled',
    schema: {
      example: { id: 'cuid', isEnabled: true, globalDepartment: { id: 'cuid', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
    },
  })
  async enableDepartment(
    @Param('id') companyId: string,
    @Param('deptId') deptId: string,
  ) {
    return this.companiesService.enableDepartment(companyId, deptId);
  }

  @Post(':id/departments/:deptId/disable')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Disable a global department for this company' })
  @ApiResponse({
    status: 200,
    description: 'Department disabled',
    schema: {
      example: { id: 'cuid', isEnabled: false, globalDepartment: { id: 'cuid', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
    },
  })
  async disableDepartment(
    @Param('id') companyId: string,
    @Param('deptId') deptId: string,
  ) {
    return this.companiesService.disableDepartment(companyId, deptId);
  }

  // ─────────────────────────────────────────────
  // MEMBERS
  // ─────────────────────────────────────────────

  @Get(':id/members')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get all active members of a company with roles' })
  @ApiResponse({
    status: 200,
    description: 'List of company members',
    schema: {
      example: [
        {
          id: 'cuid-membership-id',
          rank: 1,
          isActive: true,
          user: {
            id: 'cuid-user-id',
            username: 'user01',
            name: 'Ali Valiyev',
            phone: '+998901234567',
            avatar: null,
            systemRole: 'CLIENT_DIRECTOR',
            isActive: true,
          },
          allowedDepartments: [
            { globalDepartment: { id: 'cuid', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
          ],
        },
      ],
    },
  })
  async getMembers(@Param('id') id: string) {
    return this.companiesService.getMembers(id);
  }
}
