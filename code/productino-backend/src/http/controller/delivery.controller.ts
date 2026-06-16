import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DeliveryService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { DeliveryResponse } from '../response/delivery';

@ApiTags('Delivery')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Delivery plan (epics → stories → tasks)',
    description: 'Requires VIEW_ONLY. Empty until generated.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: DeliveryResponse })
  async tree(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<DeliveryResponse> {
    return new DeliveryResponse(await this.delivery.tree(projectId, user));
  }

  @Post()
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Generate the delivery plan from the PRD',
    description: 'Requires RUN_LLM. Decomposes the latest PRD into epics/stories/estimated tasks (replaces the plan).',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: DeliveryResponse })
  async generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<DeliveryResponse> {
    return new DeliveryResponse(await this.delivery.generate(projectId, user));
  }
}
