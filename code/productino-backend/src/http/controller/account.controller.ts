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
import { LoginResponse, UserResponse } from '../response/auth';

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
  async list(): Promise<AccountResponse[]> {
    const stats = await this.accountService.list();
    return stats.map((s) => AccountResponse.fromEntity(s.account, s.userCount));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one account (tenant)' })
  @ApiOkResponse({ type: AccountResponse })
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<AccountResponse> {
    const { account, userCount } = await this.accountService.getOne(id);
    return AccountResponse.fromEntity(account, userCount);
  }

  @Post(':id/impersonate')
  @ApiOperation({
    summary: 'Impersonate an account',
    description: 'Returns a session token as an ADMIN (or first user) of that account.',
  })
  @ApiOkResponse({ type: LoginResponse })
  async impersonate(@Param('id', ParseIntPipe) id: number): Promise<LoginResponse> {
    const issued = await this.accountService.impersonate(id);
    return new LoginResponse({
      accessToken: issued.accessToken,
      user: UserResponse.fromEntity(issued.user),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({ type: AccountResponse })
  async create(@Body() body: CreateAccountRequest): Promise<AccountResponse> {
    const account = await this.accountService.create({ name: body.name, slug: body.slug });
    return AccountResponse.fromEntity(account, 0);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiOkResponse({ type: AccountResponse })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAccountRequest,
  ): Promise<AccountResponse> {
    const { account, userCount } = await this.accountService.update(id, {
      name: body.name,
      slug: body.slug,
      bringYourOwnAi: body.bringYourOwnAi,
    });
    return AccountResponse.fromEntity(account, userCount);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account (and its users/projects/settings)' })
  @ApiOkResponse({ type: AccountResponse })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<AccountResponse> {
    const account = await this.accountService.remove(id);
    return AccountResponse.fromEntity(account, 0);
  }
}
