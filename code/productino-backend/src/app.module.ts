import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

import { PrismaService } from './prisma.service';

// Controllers — add new ones here
import { AuthController } from './http/controller/auth.controller';
import { ProjectController } from './http/controller/project.controller';
import { SettingController } from './http/controller/setting.controller';

// Services — add new ones here
import { AuthService, ProjectService, SettingService } from './services';

// Repositories — add new ones here
import {
  PermissionRepository,
  ProjectRepository,
  SettingRepository,
  UserRepository,
} from './repository';

// Cross-cutting HTTP
import { PermissionsGuard } from './http/guards';
import { AuthMiddleware } from './http/middleware/auth.middleware';
import { RequestLoggerMiddleware } from './http/middleware/request-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController, ProjectController, SettingController],
  providers: [
    PrismaService,
    // repositories
    UserRepository,
    PermissionRepository,
    SettingRepository,
    ProjectRepository,
    // services
    AuthService,
    ProjectService,
    SettingService,
    // global authorization guard (reads @RequirePermissions metadata)
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // RequestLogger first, then Auth resolves req.user from the bearer token.
    consumer.apply(RequestLoggerMiddleware, AuthMiddleware).forRoutes('*');
  }
}
