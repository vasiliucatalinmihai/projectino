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
import { PipelineQueueService, ProjectService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { PipelineJobResponse } from '../response/pipeline-job';

@ApiTags('Pipeline Jobs')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/jobs')
export class PipelineJobController {
  constructor(
    private readonly queue: PipelineQueueService,
    private readonly projectService: ProjectService,
  ) {}

  // Declared before ':jobId' so it isn't swallowed as a jobId value.
  @Get('active')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Currently in-flight job for a project, if any',
    description: 'Requires VIEW_ONLY. Lets the frontend resume watching a job after a page refresh.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: PipelineJobResponse })
  async active(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<PipelineJobResponse | null> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const result = await this.queue.activeForProject(projectId);
    return result ? new PipelineJobResponse(result) : null;
  }

  @Get(':jobId')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Status of a pipeline job',
    description: 'Requires VIEW_ONLY. Poll this after enqueueing a step until status is completed/failed.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'jobId', type: String })
  @ApiOkResponse({ type: PipelineJobResponse })
  async status(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('jobId') jobId: string,
    @CurrentUser() user: User,
  ): Promise<PipelineJobResponse | null> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const result = await this.queue.status(jobId);
    return result ? new PipelineJobResponse(result) : null;
  }
}
