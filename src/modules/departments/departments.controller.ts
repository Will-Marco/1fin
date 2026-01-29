import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, AddMemberDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { Role } from '../../../generated/prisma/client';

@ApiTags('Departments')
@Controller('companies/:companyId/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created' })
  @ApiResponse({ status: 409, description: 'Department already exists' })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all departments for a company' })
  @ApiResponse({ status: 200, description: 'List of departments' })
  async findAll(@Param('companyId') companyId: string) {
    return this.departmentsService.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiResponse({ status: 200, description: 'Department details' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated' })
  @ApiResponse({ status: 403, description: 'Cannot update default department' })
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a department (soft delete)' })
  @ApiResponse({ status: 200, description: 'Department deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete default department' })
  async remove(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.remove(companyId, id);
  }

  @Post(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Add a member to department' })
  @ApiResponse({ status: 200, description: 'Member added' })
  @ApiResponse({ status: 409, description: 'User already a member' })
  async addMember(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.departmentsService.addMember(companyId, id, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Remove a member from department' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.departmentsService.removeMember(companyId, id, userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get all members of a department' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.getMembers(companyId, id);
  }
}
