import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../../services';
import { User } from '../../entities';
import { CurrentUser, RequirePermissions } from '../decorators';
import { LoginRequest } from '../request/auth';
import { LoginResponse, UserResponse } from '../response/auth';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in with email + password, returns a JWT' })
  @ApiOkResponse({ type: LoginResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
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
