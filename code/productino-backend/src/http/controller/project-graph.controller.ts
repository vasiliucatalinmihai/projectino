import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
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
import {
  AnswerService,
  BeliefGraphService,
  ConflictService,
  CoverageService,
  ExtractionService,
  PipelineResetService,
} from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { ExtractRequest, ResetRequest } from '../request/project';
import { IngestAnswersRequest } from '../request/question';
import { ResolveConflictRequest } from '../request/conflict';
import { BeliefGraphResponse } from '../response/belief-graph';

@ApiTags('Belief Graph')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId')
export class ProjectGraphController {
  constructor(
    private readonly graph: BeliefGraphService,
    private readonly extraction: ExtractionService,
    private readonly coverage: CoverageService,
    private readonly answers: AnswerService,
    private readonly conflicts: ConflictService,
    private readonly reset: PipelineResetService,
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
      'Requires RUN_LLM. Runs the LLM over a source (the briefing by default) and ' +
      'persists belief nodes, replacing any from the same round. Returns the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: BeliefGraphResponse })
  async extract(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: ExtractRequest,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    await this.extraction.run(projectId, user, body?.sourceId);
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }

  @Post('score')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Score discovery coverage and generate clarifying questions',
    description:
      'Requires RUN_LLM. Scores the belief nodes against the rubric, regenerates ' +
      'coverage areas + questions, snapshots a round (the convergence gate), and ' +
      'returns the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: BeliefGraphResponse })
  async score(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    await this.coverage.run(projectId, user);
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }

  @Post('answers')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Ingest a client reply and re-converge',
    description:
      'Requires RUN_LLM. Maps the pasted reply onto open questions, adds an ANSWERS ' +
      'source for the next round, re-extracts (confirmed) beliefs and re-scores. ' +
      'Returns the refreshed graph — compare rounds for the confidence delta.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: BeliefGraphResponse })
  async ingestAnswers(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: IngestAnswersRequest,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    await this.answers.ingest(projectId, user, body.answers);
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }

  @Post('conflicts')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Detect contradictions between beliefs',
    description: 'Requires RUN_LLM. Replaces the conflict set with freshly detected ones. Returns the graph.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: BeliefGraphResponse })
  async detectConflicts(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
    await this.conflicts.detect(projectId, user);
    return BeliefGraphResponse.build(await this.graph.forProject(projectId, user));
  }

  @Post('reset')
  @RequirePermissions(PermissionKey.RESET_PROJECT)
  @ApiOperation({
    summary: 'Reset a step and everything downstream of it',
    description:
      'Requires RESET_PROJECT. Cascading, destructive. `from: graph` wipes the whole Belief ' +
      'Graph (beliefs, coverage, questions, rounds, conflicts) and the PRD/delivery/proposal ' +
      'built from it (sources are kept); `definition`/`delivery`/`proposal` clear from there down.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: BeliefGraphResponse })
  async resetPipeline(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: ResetRequest,
    @CurrentUser() user: User,
  ): Promise<BeliefGraphResponse> {
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
