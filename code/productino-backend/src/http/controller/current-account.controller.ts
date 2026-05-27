import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { UpdateAccountRequest } from '../request/account';
import { AccountResponse } from '../response/account';

/**
 * Self-service access to the *caller's own* account. Separate from the
 * SUPER_ADMIN-only `/accounts` controller so account admins can view and edit
 * their own tenant without cross-tenant powers.
 */
@ApiTags('Account')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('account')
export class CurrentAccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: "Get the caller's own account" })
  @ApiOkResponse({ type: AccountResponse })
  getCurrent(@CurrentUser() user: User): Promise<AccountResponse> {
    return this.accountService.getOne(user.accountId);
  }

  @Patch()
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({
    summary: "Update the caller's own account",
    description: 'Account admins can edit name/slug; bringYourOwnAi is super-admin only.',
  })
  @ApiOkResponse({ type: AccountResponse })
  updateCurrent(
    @Body() body: UpdateAccountRequest,
    @CurrentUser() user: User,
  ): Promise<AccountResponse> {
    // Strip super-admin-only fields: account admins cannot change BYO.
    return this.accountService.update(user.accountId, { name: body.name, slug: body.slug });
  }
}
