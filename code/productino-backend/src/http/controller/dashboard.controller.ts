import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DashboardOverview, DashboardService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { RequirePermissions } from '../decorators';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @RequirePermissions(PermissionKey.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Platform stats across tenant accounts',
    description: 'Super admin only. Counts and project-stage breakdown, excluding the system account.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        accountCount: { type: 'number', example: 3 },
        clientCount: { type: 'number', example: 12 },
        projectCount: { type: 'number', example: 27 },
        stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stage: { type: 'string', example: 'BRIEFING' },
              count: { type: 'number', example: 5 },
              pct: { type: 'number', example: 18.5 },
            },
          },
        },
      },
    },
  })
  overview(): Promise<DashboardOverview> {
    return this.dashboard.overview();
  }
}
