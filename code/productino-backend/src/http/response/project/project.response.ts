import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStage } from '@prisma/client';
import { Project } from '../../../entities';

export class ProjectResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Acme mobile app' })
  name: string;

  @ApiPropertyOptional({ example: 'Acme Inc.', nullable: true })
  clientName: string | null;

  @ApiProperty({ enum: ProjectStage, example: ProjectStage.BRIEFING })
  stage: ProjectStage;

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
      name: project.name,
      clientName: project.clientName,
      stage: project.stage,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  }
}
