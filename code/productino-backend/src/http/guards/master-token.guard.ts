import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Example guard: protects internal/admin endpoints with a shared secret passed
 * in the `X-Master-Token` header. Apply with `@UseGuards(MasterTokenGuard)`.
 */
@Injectable()
export class MasterTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-master-token'];
    const masterToken = this.config.get<string>('MASTER_TOKEN');

    if (!masterToken) {
      throw new UnauthorizedException('Master token is not configured');
    }
    if (!token || token !== masterToken) {
      throw new UnauthorizedException('Invalid master token');
    }
    return true;
  }
}
