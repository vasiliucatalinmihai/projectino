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
import { PromptDetailResponse, PromptSummaryResponse } from '../response/prompt';

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
  list(): Promise<PromptSummaryResponse[]> {
    return this.promptService.list();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Prompt detail: versions, per-version run stats, recent runs' })
  @ApiParam({ name: 'key', example: 'gap-analysis' })
  @ApiOkResponse({ type: PromptDetailResponse })
  detail(@Param('key') key: string): Promise<PromptDetailResponse> {
    return this.promptService.detail(key);
  }
}
