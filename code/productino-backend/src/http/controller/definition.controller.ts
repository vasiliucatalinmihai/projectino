import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
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
import { DefinitionService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { GenerateDefinitionRequest } from '../request/project';
import { ProductDefinitionResponse } from '../response/definition';

@ApiTags('Product Definition')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/definition')
export class DefinitionController {
  constructor(private readonly definitions: DefinitionService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Latest product definition (PRD) for a project',
    description: 'Requires VIEW_ONLY. Returns null if it has never been generated.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: ProductDefinitionResponse })
  async latest(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<ProductDefinitionResponse | null> {
    const d = await this.definitions.latest(projectId, user);
    return d ? ProductDefinitionResponse.fromEntity(d) : null;
  }

  @Post()
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Generate a product definition (PRD) from the belief graph',
    description:
      'Requires RUN_LLM. Gated on the latest rollup; below the gate, pass ' +
      '`override: true` (with a reason) to proceed. Returns a new version.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: ProductDefinitionResponse })
  async generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: GenerateDefinitionRequest,
    @CurrentUser() user: User,
  ): Promise<ProductDefinitionResponse> {
    const d = await this.definitions.generate(projectId, user, {
      override: body.override,
      overrideReason: body.overrideReason,
    });
    return ProductDefinitionResponse.fromEntity(d);
  }
}
