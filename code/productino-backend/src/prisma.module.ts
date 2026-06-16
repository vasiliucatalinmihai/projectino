import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global Prisma provider.
 *
 * Exporting PrismaService from a @Global() module lets every module — including
 * the LLM feature module — share a single PrismaClient instance (one connection
 * pool) without re-listing PrismaService in each module's providers.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
