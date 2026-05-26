import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../common/jwt-payload';
import { User } from '../entities';
import { UserRepository } from '../repository';
import { LoginRequest } from '../http/request/auth';
import { LoginResponse, UserResponse } from '../http/response/auth';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  /** Verify credentials and return the user (with permissions) or throw 401. */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmailWithPermissions(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async login(body: LoginRequest): Promise<LoginResponse> {
    const user = await this.validateCredentials(body.email, body.password);
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    return new LoginResponse({ accessToken, user: UserResponse.fromEntity(user) });
  }
}
