import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PromptService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { RequirePermissions } from '../decorators';
import {
  PromptDetailResponse,
  PromptRunResponse,
  PromptSummaryResponse,
  PromptVersionResponse,
} from '../response/prompt';

@ApiTags('Prompts')
@ApiBearerAuth('bearer')
@RequirePermissions(PermissionKey.MANAGE_PROMPTS) // applies to every route in this controller
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Requires the MANAGE_PROMPTS permission' })
@Controller('prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  @ApiOperation({ summary: 'List prompts with version + run counts' })
  @ApiOkResponse({ type: [PromptSummaryResponse] })
  async list(): Promise<PromptSummaryResponse[]> {
    const summaries = await this.promptService.list();
    return summaries.map((s) => new PromptSummaryResponse(s));
  }

  @Get(':key')
  @ApiOperation({ summary: 'Prompt detail: versions, per-version run stats, recent runs' })
  @ApiParam({ name: 'key', example: 'gap-analysis' })
  @ApiOkResponse({ type: PromptDetailResponse })
  async detail(@Param('key') key: string): Promise<PromptDetailResponse> {
    const detail = await this.promptService.detail(key);
    return new PromptDetailResponse({
      id: detail.id,
      key: detail.key,
      description: detail.description,
      activeVersion: detail.activeVersion,
      versions: detail.versions.map((v) => new PromptVersionResponse(v)),
      recentRuns: detail.recentRuns.map(PromptRunResponse.fromEntity),
    });
  }
}
