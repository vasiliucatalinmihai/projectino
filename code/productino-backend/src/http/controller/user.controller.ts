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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserService } from '../../services';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { CreateUserRequest, UpdateUserRequest } from '../request/user';
import { UserResponse } from '../response/auth';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient permission' })
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** Account admins (and super admins) see activation tokens; viewers don't. */
  private static canSeeTokens(user: User): boolean {
    return user.isSuperAdmin || user.permissionKeys.includes(PermissionKey.ADMIN);
  }

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY)
  @ApiOperation({ summary: 'List users in your account (all accounts for super admin)' })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: Number,
    description: 'Super admin only: scope to a specific account',
  })
  @ApiOkResponse({ type: [UserResponse] })
  async list(
    @CurrentUser() user: User,
    @Query('accountId') accountId?: string,
  ): Promise<UserResponse[]> {
    const users = await this.userService.list(user, accountId ? Number(accountId) : undefined);
    const includeToken = UserController.canSeeTokens(user);
    return users.map((u) => UserResponse.fromEntity(u, { activationToken: includeToken }));
  }

  @Post()
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({
    summary: 'Create a user in your account',
    description:
      'Created inactive with an activation token. Share the activation link so they can set their own password.',
  })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiConflictResponse({ description: 'Email already in use' })
  async create(@Body() body: CreateUserRequest, @CurrentUser() user: User): Promise<UserResponse> {
    const created = await this.userService.create(
      {
        email: body.email,
        name: body.name,
        permissions: body.permissions,
        accountId: body.accountId,
      },
      user,
    );
    return UserResponse.fromEntity(created);
  }

  @Patch(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({
    summary: "Update a user's name, permissions or active flag",
    description: 'Passwords and activation tokens are not editable here.',
  })
  @ApiOkResponse({ type: UserResponse })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserRequest,
    @CurrentUser() user: User,
  ): Promise<UserResponse> {
    const updated = await this.userService.update(
      id,
      { name: body.name, permissions: body.permissions, active: body.active },
      user,
    );
    return UserResponse.fromEntity(updated);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({
    summary: 'Reset a user (clears password, regenerates activation token, sets inactive)',
  })
  @ApiOkResponse({ type: UserResponse })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<UserResponse> {
    return UserResponse.fromEntity(await this.userService.resetPassword(id, user));
  }

  @Delete(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiOkResponse({ type: UserResponse })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<UserResponse> {
    return UserResponse.fromEntity(await this.userService.remove(id, user));
  }
}
