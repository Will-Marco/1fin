import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
import {
    AssignMembershipDto,
    CreateClientUserDto,
    CreateSystemUserDto,
    UpdateMembershipDto,
    UpdateUserDto,
} from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ─────────────────────────────────────────────
  // USER CREATION
  // ─────────────────────────────────────────────

  @Post('system')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'passport', maxCount: 1 },
      { name: 'documents', maxCount: 5 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a 1FIN system user (employee/admin/director) with passport' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'name', 'systemRole', 'passport'],
      properties: {
        username: { type: 'string', example: 'fin_employee01' },
        password: {
          type: 'string',
          example: 'SecurePass123',
          description: 'Password (optional, defaults to env DEFAULT_USER_PASSWORD)',
        },
        name: { type: 'string', example: 'Ali Valiyev' },
        phone: { type: 'string', example: '+998901234567' },
        avatar: { type: 'string', example: 'https://...' },
        systemRole: {
          type: 'string',
          enum: ['FIN_DIRECTOR', 'FIN_ADMIN', 'FIN_EMPLOYEE'],
          example: 'FIN_EMPLOYEE',
        },
        passport: {
          type: 'string',
          format: 'binary',
          description: 'Pasport fayli (required)',
        },
        documents: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 5,
          description: 'Qo\'shimcha hujjatlar (optional, max 5 ta)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'System user created with documents',
    schema: {
      example: {
        id: 'cuid-user-id',
        username: 'fin_employee01',
        name: 'Ali Valiyev',
        phone: '+998901234567',
        avatar: null,
        systemRole: 'FIN_EMPLOYEE',
        isActive: true,
        createdAt: '2024-02-24T10:00:00.000Z',
        userDocuments: [
          {
            id: 'cuid-doc-id',
            type: 'PASSPORT',
            originalName: 'passport.pdf',
            fileSize: 1024000,
            url: 'http://localhost:3000/uploads/user-documents/uuid-passport.pdf',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Passport file is required' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async createSystemUser(
    @Body() dto: CreateSystemUserDto,
    @UploadedFiles()
    files: {
      passport?: Express.Multer.File[];
      documents?: Express.Multer.File[];
    },
  ) {
    if (!files?.passport || files.passport.length === 0) {
      throw new BadRequestException('Pasport fayli majburiy');
    }

    return this.usersService.createSystemUser(
      dto,
      files.passport[0],
      files.documents,
    );
  }

  @Post('client')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'passport', maxCount: 1 },
      { name: 'documents', maxCount: 5 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a client user with passport' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'name', 'systemRole', 'passport'],
      properties: {
        username: { type: 'string', example: 'company_director01' },
        password: {
          type: 'string',
          example: 'SecurePass123',
          description: 'Password (optional, defaults to env DEFAULT_USER_PASSWORD)',
        },
        name: { type: 'string', example: 'Bobur Toshmatov' },
        phone: { type: 'string', example: '+998901234567' },
        avatar: { type: 'string', example: 'https://...' },
        systemRole: {
          type: 'string',
          enum: ['CLIENT_FOUNDER', 'CLIENT_DIRECTOR', 'CLIENT_EMPLOYEE'],
          example: 'CLIENT_EMPLOYEE',
        },
        passport: {
          type: 'string',
          format: 'binary',
          description: 'Pasport fayli (required)',
        },
        documents: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 5,
          description: 'Qo\'shimcha hujjatlar (optional, max 5 ta)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Client user created with documents',
    schema: {
      example: {
        id: 'cuid-user-id',
        username: 'company_director01',
        name: 'Bobur Toshmatov',
        phone: '+998901234567',
        avatar: null,
        systemRole: 'CLIENT_DIRECTOR',
        isActive: true,
        createdAt: '2024-02-24T10:00:00.000Z',
        userDocuments: [
          {
            id: 'cuid-doc-id',
            type: 'PASSPORT',
            originalName: 'passport.pdf',
            fileSize: 1024000,
            url: 'http://localhost:3000/uploads/user-documents/uuid-passport.pdf',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Passport file is required' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async createClientUser(
    @Body() dto: CreateClientUserDto,
    @UploadedFiles()
    files: {
      passport?: Express.Multer.File[];
      documents?: Express.Multer.File[];
    },
  ) {
    if (!files?.passport || files.passport.length === 0) {
      throw new BadRequestException('Pasport fayli majburiy');
    }

    return this.usersService.createClientUser(
      dto,
      files.passport[0],
      files.documents,
    );
  }

  // ─────────────────────────────────────────────
  // USER CRUD
  // ─────────────────────────────────────────────

  @Get()
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get all users (paginated, filterable by role visibility)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiQuery({
    name: 'systemRole',
    required: false,
    type: String,
    description: 'Filter by system roles (comma-separated)',
    example: 'FIN_EMPLOYEE,CLIENT_DIRECTOR',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users (filtered by requesting user role visibility)',
    schema: {
      example: {
        data: [
          {
            id: 'cuid-user-id',
            username: 'admin01',
            name: 'Ali Valiyev',
            phone: '+998901234567',
            avatar: null,
            systemRole: 'FIN_EMPLOYEE',
            isActive: true,
            createdAt: '2024-02-24T10:00:00.000Z',
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
    @Query('companyId') companyId?: string,
    @Query('systemRole') systemRoleFilter?: string,
    @CurrentUser('systemRole') requestingUserRole?: SystemRole,
  ) {
    const systemRoles = systemRoleFilter
      ? (systemRoleFilter.split(',') as SystemRole[])
      : undefined;

    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      {
        search,
        companyId,
        systemRole: systemRoles,
      },
      requestingUserRole,
    );
  }

  @Get(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get a user by ID (includes memberships and documents)' })
  @ApiResponse({
    status: 200,
    description: 'User with memberships and documents',
    schema: {
      example: {
        id: 'cuid-user-id',
        username: 'admin01',
        name: 'Ali Valiyev',
        phone: '+998901234567',
        avatar: null,
        systemRole: 'FIN_DIRECTOR',
        isActive: true,
        createdAt: '2024-02-24T10:00:00.000Z',
        memberships: [
          {
            id: 'cuid-membership-id',
            rank: 1,
            isActive: true,
            company: { id: 'cuid-company-id', name: 'Example LLC' },
            allowedDepartments: [
              { globalDepartment: { id: 'cuid-dept-id', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
            ],
          },
        ],
        userDocuments: [
          {
            id: 'cuid-doc-id',
            type: 'PASSPORT',
            originalName: 'passport.pdf',
            fileSize: 1024000,
            mimeType: 'application/pdf',
            url: 'http://localhost:3000/uploads/user-documents/uuid-passport.pdf',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Update user info (name, phone, avatar, rank, isActive)' })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    schema: {
      example: {
        id: 'cuid-user-id',
        username: 'admin01',
        name: 'Ali Valiyev (yangilangan)',
        phone: '+998901234567',
        avatar: null,
        systemRole: 'FIN_DIRECTOR',
        isActive: true,
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'User deactivated',
    schema: { example: { message: "Foydalanuvchi o'chirildi" } },
  })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  // ─────────────────────────────────────────────
  // MEMBERSHIP MANAGEMENT
  // ─────────────────────────────────────────────

  @Post(':id/memberships')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Assign user to a company with role & department access' })
  @ApiResponse({
    status: 201,
    description: 'Membership created',
    schema: {
      example: {
        id: 'cuid-membership-id',
        rank: 1,
        isActive: true,
        company: { id: 'cuid-company-id', name: 'Example LLC' },
        allowedDepartments: [
          { globalDepartment: { id: 'cuid-dept-id', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        ],
      },
    },
  })
  @ApiResponse({ status: 409, description: 'User already in this company' })
  async assignMembership(
    @Param('id') id: string,
    @Body() dto: AssignMembershipDto,
  ) {
    return this.usersService.assignMembership(id, dto);
  }

  @Patch(':id/memberships/:membershipId')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Update membership role and/or department access' })
  @ApiResponse({
    status: 200,
    description: 'Membership updated',
    schema: {
      example: {
        id: 'cuid-membership-id',
        rank: 2,
        isActive: true,
        allowedDepartments: [
          { globalDepartment: { id: 'cuid-dept-id', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        ],
      },
    },
  })
  async updateMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.usersService.updateMembership(id, membershipId, dto);
  }

  @Delete(':id/memberships/:membershipId')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Remove user from a company (deletes membership)' })
  @ApiResponse({
    status: 200,
    description: 'Membership deleted',
    schema: { example: { message: "A'zolik o'chirildi" } },
  })
  async removeMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.usersService.removeMembership(id, membershipId);
  }
}
