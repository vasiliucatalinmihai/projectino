import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from '../../common/jwt-payload';
import { UserRepository } from '../../repository';

/**
 * Authentication middleware. If a valid `Authorization: Bearer <jwt>` is present,
 * it loads the user (with permissions) and attaches it to `req.user`. It does NOT
 * reject requests — enforcement is the PermissionsGuard's job. An invalid or
 * expired token simply leaves the request unauthenticated.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UserRepository,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const header = req.headers['authorization'];
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token);
        const user = await this.users.findByIdWithPermissions(payload.sub);
        if (user) {
          (req as any).user = user;
        }
      } catch {
        // invalid / expired token → stay unauthenticated
      }
    }
    next();
  }
}
