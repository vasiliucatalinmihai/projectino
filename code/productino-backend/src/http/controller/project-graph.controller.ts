import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BeliefGraphService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { BeliefGraphResponse } from '../response/belief-graph';

@ApiTags('Belief Graph')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/graph')
export class ProjectGraphController {
  constructor(private readonly graph: BeliefGraphService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: "A project's Belief Graph",
    description:
      'Requires VIEW_ONLY. Returns the project sources, coverage areas, belief ' +
      'nodes, questions and round snapshots. Empty until the pipeline populates it.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: BeliefGraphResponse })
  async get(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    const g = await this.graph.forProject(projectId, user);
    return BeliefGraphResponse.build(g);
  }
}
