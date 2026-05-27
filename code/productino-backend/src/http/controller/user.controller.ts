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

  @Get()
  @RequirePermissions(PermissionKey.VIEW_ONLY) // anyone in the account can view its users
  @ApiOperation({ summary: 'List users in your account (all accounts for super admin)' })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: Number,
    description: 'Super admin only: scope to a specific account',
  })
  @ApiOkResponse({ type: [UserResponse] })
  list(
    @CurrentUser() user: User,
    @Query('accountId') accountId?: string,
  ): Promise<UserResponse[]> {
    return this.userService.list(user, accountId ? Number(accountId) : undefined);
  }

  @Post()
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Create a user in your account' })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiConflictResponse({ description: 'Email already in use' })
  create(@Body() body: CreateUserRequest, @CurrentUser() user: User): Promise<UserResponse> {
    return this.userService.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: "Update a user's name, password or permissions" })
  @ApiOkResponse({ type: UserResponse })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserRequest,
    @CurrentUser() user: User,
  ): Promise<UserResponse> {
    return this.userService.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions(PermissionKey.ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiOkResponse({ type: UserResponse })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User): Promise<UserResponse> {
    return this.userService.remove(id, user);
  }
}
