import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignCompanyDto,
  CreateWorkerTypeDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../../generated/prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  // WorkerType endpoints (must be before :id routes)

  @Post('worker-types')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create a worker type' })
  @ApiResponse({ status: 201, description: 'Worker type created' })
  @ApiResponse({ status: 409, description: 'Worker type already exists' })
  async createWorkerType(@Body() dto: CreateWorkerTypeDto) {
    return this.usersService.createWorkerType(dto);
  }

  @Get('worker-types')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get all worker types' })
  @ApiResponse({ status: 200, description: 'List of worker types' })
  async findAllWorkerTypes() {
    return this.usersService.findAllWorkerTypes();
  }

  @Delete('worker-types/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a worker type (soft delete)' })
  @ApiResponse({ status: 200, description: 'Worker type deleted' })
  async removeWorkerType(@Param('id') id: string) {
    return this.usersService.removeWorkerType(id);
  }

  // User endpoints

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('role') currentUserRole: Role,
  ) {
    return this.usersService.create(dto, currentUserRole);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: Role,
    @Query('companyId') companyId?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      role,
      companyId,
    );
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a user (soft delete)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/assign-company')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Assign user to a company' })
  @ApiResponse({ status: 200, description: 'User assigned to company' })
  async assignCompany(
    @Param('id') id: string,
    @Body() dto: AssignCompanyDto,
  ) {
    return this.usersService.assignCompany(id, dto);
  }

  @Delete(':id/unassign-company/:companyId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Unassign user from a company' })
  @ApiResponse({ status: 200, description: 'User unassigned from company' })
  async unassignCompany(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
  ) {
    return this.usersService.unassignCompany(id, companyId);
  }
}
