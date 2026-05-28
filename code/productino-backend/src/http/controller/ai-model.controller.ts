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
import { AiModelService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { CreateAiModelRequest, UpdateAiModelRequest } from '../request/ai-model';
import { AiModelResponse, EffectiveModelResponse } from '../response/ai-model';

@ApiTags('AI Models')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('ai-models')
export class AiModelController {
  constructor(private readonly aiModels: AiModelService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: "List the account's AI models", description: 'Requires VIEW_ONLY.' })
  @ApiOkResponse({ type: [AiModelResponse] })
  async findAll(@CurrentUser() user: User): Promise<AiModelResponse[]> {
    const models = await this.aiModels.findAll(user);
    return models.map(AiModelResponse.fromEntity);
  }

  @Get('effective')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Resolve the model used to process this account',
    description: "Account's active model when BYO is on, otherwise the platform default.",
  })
  @ApiOkResponse({ type: EffectiveModelResponse })
  async effective(@CurrentUser() user: User): Promise<EffectiveModelResponse> {
    const effective = await this.aiModels.effectiveForAccount(user);
    return new EffectiveModelResponse(effective);
  }

  @Post()
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Add an AI model', description: 'Requires ADMIN.' })
  @ApiCreatedResponse({ type: AiModelResponse })
  async create(
    @Body() body: CreateAiModelRequest,
    @CurrentUser() user: User,
  ): Promise<AiModelResponse> {
    return AiModelResponse.fromEntity(
      await this.aiModels.create(
        {
          label: body.label,
          provider: body.provider,
          model: body.model,
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          isActive: body.isActive,
        },
        user,
      ),
    );
  }

  @Patch(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Update an AI model', description: 'Requires ADMIN.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: AiModelResponse })
  @ApiNotFoundResponse({ description: 'AI model not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiModelRequest,
    @CurrentUser() user: User,
  ): Promise<AiModelResponse> {
    return AiModelResponse.fromEntity(
      await this.aiModels.update(
        id,
        {
          label: body.label,
          provider: body.provider,
          model: body.model,
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          isActive: body.isActive,
        },
        user,
      ),
    );
  }

  @Post(':id/activate')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Make this the active model', description: 'Requires ADMIN.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: AiModelResponse })
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<AiModelResponse> {
    return AiModelResponse.fromEntity(await this.aiModels.activate(id, user));
  }

  @Delete(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Delete an AI model', description: 'Requires ADMIN.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: AiModelResponse })
  @ApiNotFoundResponse({ description: 'AI model not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<AiModelResponse> {
    return AiModelResponse.fromEntity(await this.aiModels.remove(id, user));
  }
}
