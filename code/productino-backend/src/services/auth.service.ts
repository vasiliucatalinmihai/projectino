import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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
export interface ActivateInput {
  token: string;
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
    if (!user.active) {
      throw new UnauthorizedException('This account is not active');
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

  /**
   * Consume an activation token: set the password, clear the token, mark
   * the user active. Returns a session token so the UI can log them in.
   */
  async activate(input: ActivateInput): Promise<IssuedToken> {
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const user = await this.users.findByActivationToken(input.token);
    if (!user) throw new NotFoundException('Invalid or already-used activation link');

    await this.users.update(user.id, {
      passwordHash: await bcrypt.hash(input.password, 10),
      activationToken: null,
      active: true,
    } as any);

    const fresh = (await this.users.findByIdWithPermissions(user.id))!;
    return this.issueToken(fresh);
  }

  async issueToken(user: User): Promise<IssuedToken> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user };
  }
}
