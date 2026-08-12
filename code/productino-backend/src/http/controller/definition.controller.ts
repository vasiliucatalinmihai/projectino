import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
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
import { DefinitionService, PipelineQueueService, ProjectService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { GenerateDefinitionRequest } from '../request/project';
import { ProductDefinitionResponse } from '../response/definition';
import { EnqueuedJobResponse } from '../response/pipeline-job';

@ApiTags('Product Definition')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/definition')
export class DefinitionController {
  constructor(
    private readonly definitions: DefinitionService,
    private readonly projectService: ProjectService,
    private readonly pipelineQueue: PipelineQueueService,
  ) {}

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
      'Requires RUN_LLM. Enqueues generation, gated on the latest rollup; below the gate the job ' +
      'fails with a structured `{ gate: true, rollupConfidence, threshold }` error — pass ' +
      '`override: true` (with a reason) to proceed anyway. Poll `GET .../jobs/:jobId`.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: GenerateDefinitionRequest,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(
      await this.pipelineQueue.enqueue(projectId, user, 'definition', {
        override: body.override,
        overrideReason: body.overrideReason,
      }),
    );
  }
}
