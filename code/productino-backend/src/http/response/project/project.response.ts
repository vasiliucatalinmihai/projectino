import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStage, ProjectType } from '@prisma/client';
import { Project } from '../../../entities';

export class ProjectResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  accountId: number;

  @ApiPropertyOptional({
    example: 'Acme Agency',
    nullable: true,
    description: 'Name of the owning account (convenience copy of account.name)',
  })
  accountName: string | null;

  @ApiProperty({ example: 1 })
  clientId: number;

  @ApiProperty({ example: 'Acme mobile app' })
  name: string;

  @ApiPropertyOptional({
    example: 'Acme Inc.',
    nullable: true,
    description: "Name of the related client (convenience copy of client.name)",
  })
  clientName: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Raw initial briefing text' })
  briefing: string | null;

  @ApiProperty({ enum: ProjectStage, example: ProjectStage.BRIEFING })
  stage: ProjectStage;

  @ApiProperty({ enum: ProjectType, example: ProjectType.WEB })
  projectType: ProjectType;

  @ApiPropertyOptional({ nullable: true, description: 'Free-text label when projectType is OTHER' })
  projectTypeOtherLabel: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Romanian',
    description: 'Output language every LLM call responds in — auto-detected from the briefing, or overridden',
  })
  language: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<ProjectResponse>) {
    Object.assign(this, partial);
  }

  /** Map a Project entity to its public response shape. */
  static fromEntity(project: Project): ProjectResponse {
    return new ProjectResponse({
      id: project.id,
      accountId: project.accountId,
      accountName: project.account?.name ?? null,
      clientId: project.clientId,
      name: project.name,
      clientName: project.client?.name ?? null,
      briefing: project.briefing ?? null,
      stage: project.stage,
      projectType: project.projectType,
      projectTypeOtherLabel: project.projectTypeOtherLabel ?? null,
      language: project.language ?? null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  }
}
