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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SettingService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { RequirePermissions } from '../decorators';
import { CreateSettingRequest, UpdateSettingRequest } from '../request/setting';
import { SettingResponse } from '../response/setting';

@ApiTags('Settings')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacking the required permission' })
@Controller('settings')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'List all settings', description: 'Requires VIEW_ONLY.' })
  @ApiOkResponse({ type: [SettingResponse] })
  async findAll(): Promise<SettingResponse[]> {
    const settings = await this.settingService.findAll();
    return settings.map(SettingResponse.fromEntity);
  }

  @Get(':id')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'Get a setting by id', description: 'Requires VIEW_ONLY.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: SettingResponse })
  @ApiNotFoundResponse({ description: 'Setting not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<SettingResponse> {
    return SettingResponse.fromEntity(await this.settingService.findOne(id));
  }

  @Post()
  @RequirePermissions(PermissionKey.UPDATE_SETTINGS)
  @ApiOperation({ summary: 'Create a setting', description: 'Requires UPDATE_SETTINGS.' })
  @ApiCreatedResponse({ type: SettingResponse })
  @ApiConflictResponse({ description: 'A setting with that key already exists' })
  async create(@Body() body: CreateSettingRequest): Promise<SettingResponse> {
    return SettingResponse.fromEntity(await this.settingService.create(body));
  }

  @Patch(':id')
  @RequirePermissions(PermissionKey.UPDATE_SETTINGS)
  @ApiOperation({ summary: 'Update a setting', description: 'Requires UPDATE_SETTINGS.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: SettingResponse })
  @ApiNotFoundResponse({ description: 'Setting not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSettingRequest,
  ): Promise<SettingResponse> {
    return SettingResponse.fromEntity(await this.settingService.update(id, body));
  }

  @Delete(':id')
  @RequirePermissions(PermissionKey.UPDATE_SETTINGS)
  @ApiOperation({ summary: 'Delete a setting', description: 'Requires UPDATE_SETTINGS.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: SettingResponse })
  @ApiNotFoundResponse({ description: 'Setting not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<SettingResponse> {
    return SettingResponse.fromEntity(await this.settingService.remove(id));
  }
}
