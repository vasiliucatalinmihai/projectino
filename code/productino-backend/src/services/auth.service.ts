import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../common/jwt-payload';
import { User } from '../entities';
import { UserRepository } from '../repository';

// Service-level inputs/outputs (no HTTP DTOs).
export interface LoginInput {
  email: string;
  password: string;
}
export interface IssuedToken {
  accessToken: string;
  user: User;
}

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

  async login(input: LoginInput): Promise<IssuedToken> {
    const user = await this.validateCredentials(input.email, input.password);
    return this.issueToken(user);
  }

  /** Mint a JWT for a user (used by login and by super-admin impersonation). */
  async issueToken(user: User): Promise<IssuedToken> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user };
  }
}
