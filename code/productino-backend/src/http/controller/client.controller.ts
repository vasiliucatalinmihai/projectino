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
import { ClientService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { CreateClientRequest, UpdateClientRequest } from '../request/client';
import { ClientResponse } from '../response/client';

@ApiTags('Clients')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacking the required permission' })
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'List clients in your account', description: 'Requires VIEW_ONLY.' })
  @ApiOkResponse({ type: [ClientResponse] })
  findAll(@CurrentUser() user: User): Promise<ClientResponse[]> {
    return this.clientService.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'Get a client by id', description: 'Requires VIEW_ONLY.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ClientResponse })
  @ApiNotFoundResponse({ description: 'Client not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ClientResponse> {
    return ClientResponse.fromEntity(await this.clientService.findOne(id, user));
  }

  @Post()
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Create a client', description: 'Requires ADMIN.' })
  @ApiCreatedResponse({ type: ClientResponse })
  async create(
    @Body() body: CreateClientRequest,
    @CurrentUser() user: User,
  ): Promise<ClientResponse> {
    return ClientResponse.fromEntity(await this.clientService.create(body, user));
  }

  @Patch(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Update a client', description: 'Requires ADMIN.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ClientResponse })
  @ApiNotFoundResponse({ description: 'Client not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateClientRequest,
    @CurrentUser() user: User,
  ): Promise<ClientResponse> {
    return ClientResponse.fromEntity(await this.clientService.update(id, body, user));
  }

  @Delete(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({
    summary: 'Delete a client',
    description: 'Requires ADMIN. Fails if the client still has projects.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ClientResponse })
  @ApiNotFoundResponse({ description: 'Client not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ClientResponse> {
    return ClientResponse.fromEntity(await this.clientService.remove(id, user));
  }
}
