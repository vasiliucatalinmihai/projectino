import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { QuestionService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { CurateQuestionRequest } from '../request/question';
import { QuestionResponse } from '../response/belief-graph';
import { QuestionsDocResponse } from '../response/question';

@ApiTags('Questions')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('projects/:projectId/questions')
export class QuestionController {
  constructor(private readonly questions: QuestionService) {}

  @Get('doc')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Client-facing questions document (markdown)',
    description: 'Requires VIEW_ONLY. Included questions (or all open) with assumed answers; no internal scores.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiOkResponse({ type: QuestionsDocResponse })
  async doc(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ): Promise<QuestionsDocResponse> {
    return new QuestionsDocResponse(await this.questions.buildClientDoc(projectId, user));
  }

  @Patch(':questionId')
  @RequirePermissions(PermissionKey.RUN_LLM)
  @ApiOperation({
    summary: 'Curate a question (include / exclude / edit)',
    description: 'Requires RUN_LLM. Update a question\'s status, text or assumed answer.',
  })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'questionId', type: Number })
  @ApiOkResponse({ type: QuestionResponse })
  @ApiNotFoundResponse({ description: 'Question not found' })
  async curate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: CurateQuestionRequest,
    @CurrentUser() user: User,
  ): Promise<QuestionResponse> {
    const q = await this.questions.update(projectId, questionId, user, {
      status: body.status,
      text: body.text,
      assumedAnswer: body.assumedAnswer,
    });
    return QuestionResponse.fromEntity(q);
  }
}
