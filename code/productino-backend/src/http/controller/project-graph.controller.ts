import { Body, ConflictException, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
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
import { BeliefGraphService, ConflictService, PipelineQueueService, PipelineResetService, ProjectService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { ExtractRequest, IngestNotesRequest, ResetRequest } from '../request/project';
import { IngestAnswersRequest } from '../request/question';
import { ResolveConflictRequest } from '../request/conflict';
import { BeliefGraphResponse } from '../response/belief-graph';
import { EnqueuedJobResponse } from '../response/pipeline-job';

@ApiTags('Belief Graph')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId')
export class ProjectGraphController {
  constructor(
    private readonly graph: BeliefGraphService,
    private readonly conflicts: ConflictService,
    private readonly reset: PipelineResetService,
    private readonly projectService: ProjectService,
    private readonly pipelineQueue: PipelineQueueService,
  ) {}

  @Get('graph')
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
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }

  @Post('extract')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Extract belief nodes from a project source',
    description:
      'Requires RUN_LLM. Enqueues extraction over a source (the briefing by default); poll ' +
      '`GET jobs/:jobId` until it completes, then re-fetch the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async extract(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: ExtractRequest,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(
      await this.pipelineQueue.enqueue(projectId, user, 'extract', { sourceId: body?.sourceId }),
    );
  }

  @Post('score')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Score discovery coverage and generate clarifying questions',
    description:
      'Requires RUN_LLM. Enqueues coverage scoring (both Business Analyst and Tech Lead ' +
      'passes); poll `GET jobs/:jobId` until it completes, then re-fetch the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async score(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(await this.pipelineQueue.enqueue(projectId, user, 'score'));
  }

  @Post('answers')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Ingest a client reply and re-converge',
    description:
      'Requires RUN_LLM. Enqueues mapping the reply onto open questions, re-extraction and ' +
      're-scoring; poll `GET jobs/:jobId` until it completes, then re-fetch the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async ingestAnswers(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: IngestAnswersRequest,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(
      await this.pipelineQueue.enqueue(projectId, user, 'answers', { answersText: body.answers }),
    );
  }

  @Post('notes')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Add extra info outside the Q&A loop (e.g. call/meeting notes) and re-converge',
    description:
      'Requires RUN_LLM. For information that came up in a call or discussion rather than as an ' +
      "answer to a specific question. Doesn't require open questions to exist. Enqueues adding a " +
      'TRANSCRIPT (or EMAIL) source, extraction and re-scoring; poll `GET jobs/:jobId`.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async ingestNotes(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: IngestNotesRequest,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(
      await this.pipelineQueue.enqueue(projectId, user, 'notes', {
        content: body.content,
        kind: body.kind,
        label: body.label,
      }),
    );
  }

  @Post('conflicts')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Detect contradictions between beliefs',
    description:
      'Requires RUN_LLM. Enqueues conflict detection (replaces the conflict set); poll ' +
      '`GET jobs/:jobId` until it completes, then re-fetch the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiAcceptedResponse({ type: EnqueuedJobResponse })
  async detectConflicts(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<EnqueuedJobResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    return new EnqueuedJobResponse(await this.pipelineQueue.enqueue(projectId, user, 'conflicts'));
  }

  @Post('reset')
  @RequirePermissions(PermissionKey.RESET_PROJECT)
  @ApiOperation({
    summary: 'Reset a step and everything downstream of it',
    description:
      'Requires RESET_PROJECT. Cascading, destructive, synchronous (not queued — it only deletes ' +
      'rows). `from: graph` wipes the whole Belief Graph (beliefs, coverage, questions, rounds, ' +
      'conflicts) and the PRD/delivery/proposal built from it (sources are kept); ' +
      '`definition`/`delivery`/`proposal` clear from there down. Rejected while a pipeline job is ' +
      'still running for this project.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: BeliefGraphResponse })
  async resetPipeline(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: ResetRequest,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const active = await this.pipelineQueue.activeForProject(projectId);
    if (active) throw new ConflictException(`A "${active.step}" job is still running for this project.`);
    await this.reset.resetFrom(projectId, user, body.from);
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }

  @Patch('conflicts/:conflictId')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({ summary: 'Resolve / reopen a conflict', description: 'Requires RUN_LLM.' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'conflictId', type: Number })
  @ApiOkResponse({ type: BeliefGraphResponse })
  async resolveConflict(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('conflictId', ParseIntPipe) conflictId: number,
    @Body() body: ResolveConflictRequest,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    await this.conflicts.setStatus(projectId, conflictId, user, body.status);
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }
}
