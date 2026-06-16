import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductDefinition } from '../../../entities';

export class ProductDefinitionResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) projectId: number;
  @ApiProperty({ example: 1, description: 'Version (incrementing per project)' })
  version: number;
  @ApiProperty({
    description: 'Structured PRD: summary, in_scope, out_of_scope, user_stories, non_functional, assumptions, risks',
    type: 'object',
    additionalProperties: true,
  })
  content: Record<string, any>;
  @ApiProperty({ example: 0.72, description: 'Rollup confidence (0–1) when generated' })
  confidenceAtGeneration: number;
  @ApiProperty({ example: false, description: 'True if generated below the confidence gate' })
  gateOverride: boolean;
  @ApiPropertyOptional({ nullable: true }) overrideReason: string | null;
  @ApiProperty() createdAt: Date;

  constructor(partial: Partial<ProductDefinitionResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(definition: ProductDefinition): ProductDefinitionResponse {
    return new ProductDefinitionResponse({
      id: definition.id,
      projectId: definition.projectId,
      version: definition.version,
      content: (definition.content ?? {}) as Record<string, any>,
      confidenceAtGeneration: definition.confidenceAtGeneration,
      gateOverride: definition.gateOverride,
      overrideReason: definition.overrideReason ?? null,
      createdAt: definition.createdAt,
    });
  }
}
