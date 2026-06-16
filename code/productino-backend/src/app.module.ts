import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma.module';
import { LlmModule } from './llm';

// Controllers — add new ones here
import { AuthController } from './http/controller/auth.controller';
import { AccountController } from './http/controller/account.controller';
import { CurrentAccountController } from './http/controller/current-account.controller';
import { UserController } from './http/controller/user.controller';
import { ClientController } from './http/controller/client.controller';
import { AiModelController } from './http/controller/ai-model.controller';
import { ProjectController } from './http/controller/project.controller';
import { ProjectGraphController } from './http/controller/project-graph.controller';
import { DashboardController } from './http/controller/dashboard.controller';
import { SettingController } from './http/controller/setting.controller';
import { PromptController } from './http/controller/prompt.controller';

// Services — add new ones here
import {
  AuthService,
  AccountService,
  UserService,
  ClientService,
  AiModelService,
  AiModelCatalogService,
  ProjectService,
  BeliefGraphService,
  DashboardService,
  SettingService,
  PromptManagerService,
  PromptService,
} from './services';

// Repositories — add new ones here
import {
  AccountRepository,
  ClientRepository,
  AiModelRepository,
  PermissionRepository,
  ProjectRepository,
  PromptRepository,
  PromptVersionRepository,
  PromptRunRepository,
  SettingRepository,
  UserRepository,
  SourceRepository,
  BeliefNodeRepository,
  CoverageAreaRepository,
  QuestionRepository,
  ProjectRoundRepository,
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
    PrismaModule,
    LlmModule,
  ],
  controllers: [
    AuthController,
    AccountController,
    CurrentAccountController,
    UserController,
    ClientController,
    AiModelController,
    ProjectController,
    ProjectGraphController,
    DashboardController,
    SettingController,
    PromptController,
  ],
  providers: [
    // repositories
    AccountRepository,
    UserRepository,
    PermissionRepository,
    ClientRepository,
    AiModelRepository,
    SettingRepository,
    PromptRepository,
    PromptVersionRepository,
    PromptRunRepository,
    ProjectRepository,
    SourceRepository,
    BeliefNodeRepository,
    CoverageAreaRepository,
    QuestionRepository,
    ProjectRoundRepository,
    // services
    AuthService,
    AccountService,
    UserService,
    ClientService,
    AiModelService,
    AiModelCatalogService,
    ProjectService,
    BeliefGraphService,
    DashboardService,
    SettingService,
    PromptManagerService,
    PromptService,
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
