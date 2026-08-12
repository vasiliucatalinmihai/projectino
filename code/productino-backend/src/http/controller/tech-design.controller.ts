import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PipelineQueueService, ProjectService, TechDesignService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { TechDesignResponse } from '../response/tech-design';
import { EnqueuedJobResponse } from '../response/pipeline-job';

@ApiTags('Tech Design')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/tech-design')
export class TechDesignController {
  constructor(
    private readonly techDesign: TechDesignService,
    private readonly projectService: ProjectService,
    private readonly pipelineQueue: PipelineQueueService,
  ) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Latest Tech Lead architecture for a project',
    description: 'Requires VIEW_ONLY. Returns null if it has never been generated.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: TechDesignResponse })
  async latest(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<TechDesignResponse | null> {
    const d = await this.techDesign.latest(projectId, user);
    return d ? TechDesignResponse.fromEntity(d) : null;
  }

  @Post()
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Generate the Tech Lead architecture from the product definition',
    description:
      'Requires RUN_LLM. Enqueues recommending frontend/backend/database/API/infra choices, ' +
      'critiqued once through a Business-Analyst lens for feasibility. Not applicable to ' +
      'pure-consulting project types. Poll `GET .../jobs/:jobId`.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(await this.pipelineQueue.enqueue(projectId, user, 'tech-design'));
  }
}
