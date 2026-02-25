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
import { SystemRoles } from '../../common/decorators';
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
  @ApiOperation({ summary: 'Create a 1FIN system user (employee/admin/director)' })
  @ApiResponse({ status: 201, description: 'System user created' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async createSystemUser(@Body() dto: CreateSystemUserDto) {
    return this.usersService.createSystemUser(dto);
  }

  @Post('client')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Create a client user (no systemRole, assign to company separately)' })
  @ApiResponse({ status: 201, description: 'Client user created' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async createClientUser(@Body() dto: CreateClientUserDto) {
    return this.usersService.createClientUser(dto);
  }

  // ─────────────────────────────────────────────
  // USER CRUD
  // ─────────────────────────────────────────────

  @Get()
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get all users (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      {
        search,
        companyId,
      },
    );
  }

  @Get(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN, SystemRole.FIN_EMPLOYEE)
  @ApiOperation({ summary: 'Get a user by ID (includes memberships)' })
  @ApiResponse({ status: 200, description: 'User with memberships' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Update user info (name, phone, avatar, rank, isActive)' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  // ─────────────────────────────────────────────
  // MEMBERSHIP MANAGEMENT
  // ─────────────────────────────────────────────

  @Post(':id/memberships')
  @SystemRoles(SystemRole.FIN_DIRECTOR, SystemRole.FIN_ADMIN)
  @ApiOperation({ summary: 'Assign user to a company with role & department access' })
  @ApiResponse({ status: 201, description: 'Membership created' })
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
  @ApiResponse({ status: 200, description: 'Membership updated' })
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
  @ApiResponse({ status: 200, description: 'Membership deleted' })
  async removeMembership(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.usersService.removeMembership(id, membershipId);
  }
}
