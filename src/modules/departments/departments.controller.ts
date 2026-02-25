import {
    Body,
    Controller,
    Delete,
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
import { SystemRole } from '../../../generated/prisma/client';
import { CurrentUser, SystemRoles } from '../../common/decorators';
import { SystemRoleGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards';
import { DepartmentsService } from './departments.service';
import { CreateGlobalDepartmentDto, UpdateGlobalDepartmentDto } from './dto';

@ApiTags('Global Departments')
@Controller('global-departments')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Create a new global department' })
  @ApiResponse({
    status: 201,
    description: 'Global department created',
    schema: {
      example: {
        id: 'cuid-dept-id',
        name: 'Buxgalteriya',
        slug: 'buxgalteriya',
        isActive: true,
        createdAt: '2024-02-24T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async create(@Body() dto: CreateGlobalDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get all global departments' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive departments',
  })
  @ApiResponse({
    status: 200,
    description: 'List of global departments',
    schema: {
      example: [
        { id: 'cuid', name: 'Buxgalteriya', slug: 'buxgalteriya', isActive: true, createdAt: '2024-02-24T10:00:00.000Z', _count: { companyConfigs: 5 } },
        { id: 'cuid', name: 'Yuridik', slug: 'yuridik', isActive: true, createdAt: '2024-02-24T10:00:00.000Z', _count: { companyConfigs: 3 } },
      ],
    },
  })
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.departmentsService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get a global department by ID' })
  @ApiResponse({
    status: 200,
    description: 'Department details',
    schema: {
      example: {
        id: 'cuid-dept-id',
        name: 'Buxgalteriya',
        slug: 'buxgalteriya',
        isActive: true,
        createdAt: '2024-02-24T10:00:00.000Z',
        updatedAt: '2024-02-24T10:00:00.000Z',
        _count: { companyConfigs: 5 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Patch(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Update a global department (name, slug, or isActive)' })
  @ApiResponse({
    status: 200,
    description: 'Department updated',
    schema: {
      example: {
        id: 'cuid-dept-id',
        name: 'Buxgalteriya (yangilangan)',
        slug: 'buxgalteriya',
        isActive: true,
        updatedAt: '2024-02-24T12:00:00.000Z',
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalDepartmentDto,
  ) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Deactivate a global department (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Department deactivated',
    schema: { example: { message: "Global department o'chirildi" } },
  })
  async deactivate(@Param('id') id: string) {
    return this.departmentsService.deactivate(id);
  }

  // ─────────────────────────────────────────────
  // UNREAD MESSAGES ENDPOINTS
  // ─────────────────────────────────────────────

  @Get('unread-summary/:companyId')
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
    SystemRole.CLIENT_FOUNDER,
    SystemRole.CLIENT_DIRECTOR,
    SystemRole.CLIENT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Get unread message counts for all departments' })
  @ApiResponse({
    status: 200,
    description: 'Returns unread count per department and total',
    schema: {
      example: {
        departments: [
          { departmentId: 'cuid', departmentName: 'Buxgalteriya', departmentSlug: 'buxgalteriya', unreadCount: 5 },
          { departmentId: 'cuid', departmentName: 'Yuridik', departmentSlug: 'yuridik', unreadCount: 0 },
        ],
        totalUnread: 5,
      },
    },
  })
  async getUnreadSummary(
    @Param('companyId') companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole,
  ) {
    return this.departmentsService.getUnreadSummary(userId, companyId, systemRole);
  }

  @Post(':id/mark-read/:companyId')
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
    SystemRole.CLIENT_FOUNDER,
    SystemRole.CLIENT_DIRECTOR,
    SystemRole.CLIENT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Mark a department as read' })
  @ApiResponse({
    status: 200,
    description: 'Department marked as read',
    schema: { example: { message: "Bo'lim o'qilgan deb belgilandi" } },
  })
  async markDepartmentAsRead(
    @Param('id') departmentId: string,
    @Param('companyId') companyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.departmentsService.markDepartmentAsRead(userId, companyId, departmentId);
  }

  @Post('mark-all-read/:companyId')
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.FIN_EMPLOYEE,
    SystemRole.CLIENT_FOUNDER,
    SystemRole.CLIENT_DIRECTOR,
    SystemRole.CLIENT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Mark all departments as read' })
  @ApiResponse({
    status: 200,
    description: 'All departments marked as read',
    schema: { example: { message: "Barcha bo'limlar o'qilgan deb belgilandi", count: 5 } },
  })
  async markAllAsRead(
    @Param('companyId') companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('systemRole') systemRole: SystemRole,
  ) {
    return this.departmentsService.markAllAsRead(userId, companyId, systemRole);
  }
}
