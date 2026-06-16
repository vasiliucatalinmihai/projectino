import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AiModelCatalogService, AiModelService, TestConnectionResult } from '../../services';
import { ModelCatalog } from '../../common/ai-catalog';
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
  constructor(
    private readonly aiModels: AiModelService,
    private readonly catalog: AiModelCatalogService,
  ) {}

  @Get('catalog')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Provider → selectable models for the admin dropdowns',
    description:
      "Editable at runtime via the system account's AI_MODEL_CATALOG setting; falls back to a built-in default.",
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        catalog: {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
          example: { anthropic: ['claude-opus-4-8'], openai: ['gpt-4o'] },
        },
      },
    },
  })
  async getCatalog(): Promise<{ catalog: ModelCatalog }> {
    return { catalog: await this.catalog.get() };
  }

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: "List AI models in your account (any account for super admin)",
    description: 'Requires VIEW_ONLY.',
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: Number,
    description: 'Super admin only: scope to a specific account',
  })
  @ApiOkResponse({ type: [AiModelResponse] })
  async findAll(
    @CurrentUser() user: User,
    @Query('accountId') accountId?: string,
  ): Promise<AiModelResponse[]> {
    const models = await this.aiModels.findAll(user, accountId ? Number(accountId) : undefined);
    return models.map(AiModelResponse.fromEntity);
  }

  @Get('effective')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({
    summary: 'Resolve the model used to process an account',
    description:
      "Account's active model when BYO is on, otherwise the system default. Super admin may pass accountId.",
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: Number,
    description: 'Super admin only: scope to a specific account',
  })
  @ApiOkResponse({ type: EffectiveModelResponse })
  async effective(
    @CurrentUser() user: User,
    @Query('accountId') accountId?: string,
  ): Promise<EffectiveModelResponse> {
    const effective = await this.aiModels.effectiveForAccount(
      user,
      accountId ? Number(accountId) : undefined,
    );
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
          options: body.options,
          isActive: body.isActive,
          accountId: body.accountId,
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
          options: body.options,
          isActive: body.isActive,
        },
        user,
      ),
    );
  }

  @Post(':id/test')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({
    summary: 'Test the model credentials with a tiny live call',
    description: 'Requires ADMIN. Returns { ok, message } — never errors on an auth/provider failure.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        provider: { type: 'string', example: 'anthropic' },
        model: { type: 'string', example: 'claude-opus-4-8' },
        latencyMs: { type: 'number', nullable: true, example: 540 },
        message: { type: 'string', nullable: true, example: 'Provider returned 401: …' },
      },
    },
  })
  test(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<TestConnectionResult> {
    return this.aiModels.testConnection(id, user);
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
