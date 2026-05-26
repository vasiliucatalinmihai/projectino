import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../entities';

/** Injects the authenticated user that AuthMiddleware attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User | undefined => {
    return context.switchToHttp().getRequest()['user'] as User | undefined;
  },
);
