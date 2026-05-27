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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { RequirePermissions } from '../decorators';
import { CreateAccountRequest, UpdateAccountRequest } from '../request/account';
import { AccountResponse } from '../response/account';
import { LoginResponse } from '../response/auth';

@ApiTags('Accounts')
@ApiBearerAuth('bearer')
@RequirePermissions(PermissionKey.SUPER_ADMIN) // platform owner only
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Requires SUPER_ADMIN' })
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'List all accounts (tenants)' })
  @ApiOkResponse({ type: [AccountResponse] })
  list(): Promise<AccountResponse[]> {
    return this.accountService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one account (tenant)' })
  @ApiOkResponse({ type: AccountResponse })
  getOne(@Param('id', ParseIntPipe) id: number): Promise<AccountResponse> {
    return this.accountService.getOne(id);
  }

  @Post(':id/impersonate')
  @ApiOperation({
    summary: 'Impersonate an account',
    description: 'Returns a session token as an ADMIN (or first user) of that account.',
  })
  @ApiOkResponse({ type: LoginResponse })
  impersonate(@Param('id', ParseIntPipe) id: number): Promise<LoginResponse> {
    return this.accountService.impersonate(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({ type: AccountResponse })
  create(@Body() body: CreateAccountRequest): Promise<AccountResponse> {
    return this.accountService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiOkResponse({ type: AccountResponse })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAccountRequest,
  ): Promise<AccountResponse> {
    return this.accountService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account (and its users/projects/settings)' })
  @ApiOkResponse({ type: AccountResponse })
  remove(@Param('id', ParseIntPipe) id: number): Promise<AccountResponse> {
    return this.accountService.remove(id);
  }
}
