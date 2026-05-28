import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
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
import { CreateProjectRequest, UpdateProjectRequest } from '../request/project';
import { ProjectResponse } from '../response/project';

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
    const projects = await this.projectService.findAll(user);
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
    return ProjectResponse.fromEntity(await this.projectService.findOne(id, user));
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
