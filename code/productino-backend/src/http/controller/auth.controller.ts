import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService, UserService } from '../../services';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { ActivateRequest, LoginRequest } from '../request/auth';
import { LoginResponse, UserResponse } from '../response/auth';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in with email + password, returns a JWT' })
  @ApiOkResponse({ type: LoginResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    const issued = await this.authService.login({ email: body.email, password: body.password });
    return new LoginResponse({
      accessToken: issued.accessToken,
      user: UserResponse.fromEntity(issued.user),
    });
  }

  @Post('activate')
  @ApiOperation({
    summary: 'Consume an activation token to set a password',
    description: 'Sets the user active, mints a session token so the UI logs them in immediately.',
  })
  @ApiOkResponse({ type: LoginResponse })
  async activate(@Body() body: ActivateRequest): Promise<LoginResponse> {
    const issued = await this.authService.activate({ token: body.token, password: body.password });
    return new LoginResponse({
      accessToken: issued.accessToken,
      user: UserResponse.fromEntity(issued.user),
    });
  }

  @Post('reset-my-password')
  @RequirePermissions() // authenticated only — any logged-in user
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Reset your own password',
    description:
      'Clears your password, marks you inactive, and returns a fresh activation token so you can set a new password through /activate.',
  })
  @ApiOkResponse({ type: UserResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async resetMyPassword(@CurrentUser() user: User): Promise<UserResponse> {
    return UserResponse.fromEntity(await this.userService.resetSelf(user));
  }

  @Get('me')
  @RequirePermissions() // authenticated only — any logged-in user
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({ type: UserResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  me(@CurrentUser() user: User): UserResponse {
    return UserResponse.fromEntity(user);
  }
}
