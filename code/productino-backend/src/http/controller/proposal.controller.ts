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
import { ProposalService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { ProposalResponse, ProposalDocResponse } from '../response/proposal';

@ApiTags('Proposal')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/proposal')
export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'Latest proposal for a project', description: 'Requires VIEW_ONLY. Null if never generated.' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: ProposalResponse })
  async latest(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<ProposalResponse | null> {
    const p = await this.proposals.latest(projectId, user);
    return p ? ProposalResponse.fromEntity(p) : null;
  }

  @Get('doc')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'Client-facing proposal (markdown)', description: 'Requires VIEW_ONLY.' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: ProposalDocResponse })
  async doc(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<ProposalDocResponse> {
    return new ProposalDocResponse(await this.proposals.buildDoc(projectId, user));
  }

  @Post()
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Generate a priced proposal from the delivery plan',
    description: 'Requires RUN_LLM. Prices the plan (day-rate + buffer) and writes the prose. New version.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiCreatedResponse({ type: ProposalResponse })
  async generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<ProposalResponse> {
    return ProposalResponse.fromEntity(await this.proposals.generate(projectId, user));
  }
}
