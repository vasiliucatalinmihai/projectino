import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { MAX_RUBRIC_AREAS } from '../../../services/rubric.service';

/**
 * Replace a project's rubric override. The shallow shape is validated here; the
 * deep rules (keys must exist in the catalog, valid weights, etc.) live in
 * RubricService.normalizeConfig and surface as a 400.
 */
export class SetRubricRequest {
  @ApiProperty({
    type: [String],
    example: ['functional_scope', 'data', 'compliance'],
    description: 'Catalog area keys to enable. Must be known keys.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RUBRIC_AREAS)
  @IsString({ each: true })
  enabled: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { compliance: { weight: 'high' }, data: { hint: 'EU residency, retention' } },
    description: 'Optional per-area overrides (weight/name/hint), keyed by an enabled area key.',
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, { weight?: string; name?: string; hint?: string }>;
}
