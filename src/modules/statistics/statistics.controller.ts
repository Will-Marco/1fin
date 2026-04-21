import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemRoles } from '../../common/decorators/system-roles.decorator';
import { ThrottleRead } from '../../common/decorators/throttle.decorator';
import { SystemRoleGuard } from '../../common/guards/system-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetStatisticsDto } from './dto/get-statistics.dto';
import { StatisticsService } from './statistics.service';

interface JwtUser {
  id: string;
  systemRole: SystemRole;
  memberships?: Array<{ companyId: string; isActive: boolean }>;
}

@ApiTags('Statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @ThrottleRead()
  @ApiOperation({
    summary: 'Tizim va kompaniya statistikasini olish',
    description: `
      - FIN_DIRECTOR/FIN_ADMIN: Barcha kompaniyalar statistikasini ko'rishi mumkin (companyId ixtiyoriy)
      - CLIENT_FOUNDER/CLIENT_DIRECTOR: Faqat o'z kompaniyasi statistikasini ko'radi (companyId majburiy)
    `,
  })
  @SystemRoles(
    SystemRole.FIN_DIRECTOR,
    SystemRole.FIN_ADMIN,
    SystemRole.CLIENT_FOUNDER,
    SystemRole.CLIENT_DIRECTOR,
  )
  @ApiOkResponse({
    description: 'Statistika muvaffaqiyatli olindi',
    schema: {
      example: {
        documents: {
          total: 150,
          accepted: 120,
          rejected: 15,
          autoExpired: 5,
          pending: 10,
          avgResponseHours: 4.5,
        },
        messages: {
          total: 1250,
          byType: {
            TEXT: 1000,
            FILE: 150,
            VOICE: 80,
            DOCUMENT_FORWARD: 20,
          },
        },
        files: {
          total: 350,
          totalSizeMB: 1024.5,
        },
        period: {
          from: '2024-01-01T00:00:00.000Z',
          to: '2024-01-31T23:59:59.999Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Noto'g'ri so'rov parametrlari",
    schema: {
      example: {
        statusCode: 400,
        message: 'CUSTOM period requires "from" and "to" dates.',
        error: 'Bad Request',
      },
    },
  })
  async getStatistics(
    @Query() dto: GetStatisticsDto,
    @CurrentUser() user: JwtUser,
  ) {
    const isSystemStaff =
      user.systemRole === SystemRole.FIN_DIRECTOR ||
      user.systemRole === SystemRole.FIN_ADMIN;

    // Mijoz foydalanuvchilari uchun kompaniya tekshiruvi
    if (!isSystemStaff) {
      // Agar mijoz companyId bermagan bo'lsa, birinchi aktiv membershipni olish
      if (!dto.companyId) {
        const activeMembership = user.memberships?.find((m) => m.isActive);
        if (!activeMembership) {
          throw new BadRequestException(
            "Siz hech qanday kompaniyaga bog'lanmagansiz",
          );
        }
        dto.companyId = activeMembership.companyId;
      } else {
        // Mijoz faqat o'z kompaniyasini ko'rishi mumkin
        const hasAccess = user.memberships?.some(
          (m) => m.companyId === dto.companyId && m.isActive,
        );
        if (!hasAccess) {
          throw new BadRequestException(
            "Siz ushbu kompaniya statistikasini ko'rish huquqiga ega emassiz",
          );
        }
      }
    }

    return this.statisticsService.getStatistics(dto);
  }
}
