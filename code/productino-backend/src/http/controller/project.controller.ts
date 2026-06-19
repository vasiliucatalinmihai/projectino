import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProjectService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { CreateProjectRequest, SetRubricRequest, UpdateProjectRequest } from '../request/project';
import { ProjectResponse, ProjectRubricResponse, ProjectUsageResponse } from '../response/project';

@ApiTags('Projects')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacking the required permission' })
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'List projects in your account', description: 'Requires VIEW_ONLY.' })
  @ApiOkResponse({ type: [ProjectResponse] })
  async findAll(@CurrentUser() user: User): Promise<ProjectResponse[]> {
    const projects = await this.projectService.getAllProjectsForUser(user);
    return projects.map(ProjectResponse.fromEntity);
  }

  @Get(':id')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'Get a project by id', description: 'Requires VIEW_ONLY.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectResponse })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ProjectResponse> {
    return ProjectResponse.fromEntity(await this.projectService.getProjectForUser(id, user));
  }

  @Get(':id/usage')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'LLM token usage for a project',
    description: 'Requires VIEW_ONLY. Summed from the project\'s logged prompt runs, with a per-stage breakdown.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectUsageResponse })
  async usage(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ProjectUsageResponse> {
    return new ProjectUsageResponse(await this.projectService.tokenUsage(id, user));
  }

  @Get(':id/rubric')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: "A project's discovery rubric",
    description:
      'Requires VIEW_ONLY. The effective rubric scored against, whether it is ' +
      'customized, and the full catalog of available areas.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectRubricResponse })
  async getRubric(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ProjectRubricResponse> {
    return ProjectRubricResponse.from(await this.projectService.getRubric(id, user));
  }

  @Put(':id/rubric')
  @RequirePermissions(PermissionKey.UPDATE_SETTINGS)
  @ApiOperation({
    summary: "Set a project's rubric override",
    description:
      'Requires UPDATE_SETTINGS. Enables a subset of the catalog areas with ' +
      'optional per-area overrides (weight/name/hint).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectRubricResponse })
  @ApiBadRequestResponse({ description: 'Invalid rubric configuration' })
  async setRubric(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetRubricRequest,
    @CurrentUser() user: User,
  ): Promise<ProjectRubricResponse> {
    return ProjectRubricResponse.from(await this.projectService.setRubric(id, body, user));
  }

  @Delete(':id/rubric')
  @RequirePermissions(PermissionKey.UPDATE_SETTINGS)
  @ApiOperation({
    summary: "Clear a project's rubric override",
    description: 'Requires UPDATE_SETTINGS. Reverts the project to the built-in default rubric.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectRubricResponse })
  async clearRubric(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ProjectRubricResponse> {
    return ProjectRubricResponse.from(await this.projectService.setRubric(id, null, user));
  }

  @Post()
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Create a project', description: 'Requires ADMIN.' })
  @ApiCreatedResponse({ type: ProjectResponse })
  async create(
    @Body() body: CreateProjectRequest,
    @CurrentUser() user: User,
  ): Promise<ProjectResponse> {
    return ProjectResponse.fromEntity(
      await this.projectService.create(
        { name: body.name, clientId: body.clientId, briefing: body.briefing },
        user,
      ),
    );
  }

  @Patch(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Update a project', description: 'Requires ADMIN.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectResponse })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectRequest,
    @CurrentUser() user: User,
  ): Promise<ProjectResponse> {
    return ProjectResponse.fromEntity(
      await this.projectService.update(
        id,
        {
          name: body.name,
          clientId: body.clientId,
          briefing: body.briefing,
          stage: body.stage,
        },
        user,
      ),
    );
  }

  @Delete(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Delete a project', description: 'Requires ADMIN.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ProjectResponse })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ProjectResponse> {
    return ProjectResponse.fromEntity(await this.projectService.remove(id, user));
  }
}
