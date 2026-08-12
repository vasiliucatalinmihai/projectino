import { ApiProperty } from '@nestjs/swagger';
import { TechDesign } from '../../../entities';

export class TechDesignResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) projectId: number;
  @ApiProperty({ example: 1, description: 'Version (incrementing per project)' })
  version: number;
  @ApiProperty({
    description: 'Structured architecture: frontend, backend, database, apiStyle, infra, keyLibraries, risks',
    type: 'object',
    additionalProperties: true,
  })
  content: Record<string, any>;
  @ApiProperty({ example: 0.72, description: "Confidence of the definition it was built from, when generated" })
  confidenceAtGeneration: number;
  @ApiProperty() createdAt: Date;

  constructor(partial: Partial<TechDesignResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(techDesign: TechDesign): TechDesignResponse {
    return new TechDesignResponse({
      id: techDesign.id,
      projectId: techDesign.projectId,
      version: techDesign.version,
      content: (techDesign.content ?? {}) as Record<string, any>,
      confidenceAtGeneration: techDesign.confidenceAtGeneration,
      createdAt: techDesign.createdAt,
    });
  }
}
