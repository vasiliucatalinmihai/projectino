import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRubric } from '../../../services/project.service';
import { RubricArea } from '../../../services/rubric.service';

export class RubricAreaResponse {
  @ApiProperty({ example: 'compliance' }) key: string;
  @ApiProperty({ example: 'Compliance & data protection' }) name: string;
  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' }) weight: string;
  @ApiPropertyOptional({ nullable: true, description: 'Guidance on what "covered" means for this area' })
  hint: string | null;

  static fromArea(area: RubricArea): RubricAreaResponse {
    return Object.assign(new RubricAreaResponse(), {
      key: area.key,
      name: area.name,
      weight: area.weight,
      hint: area.hint ?? null,
    });
  }
}

export class ProjectRubricResponse {
  @ApiProperty({ description: 'Whether the project uses a custom rubric (vs. the built-in default)' })
  isCustom: boolean;

  @ApiProperty({ type: [RubricAreaResponse], description: 'The effective rubric scored against' })
  areas: RubricAreaResponse[];

  @ApiProperty({ type: [RubricAreaResponse], description: 'The full catalog of available areas' })
  catalog: RubricAreaResponse[];

  static from(rubric: ProjectRubric): ProjectRubricResponse {
    return Object.assign(new ProjectRubricResponse(), {
      isCustom: rubric.isCustom,
      areas: rubric.areas.map(RubricAreaResponse.fromArea),
      catalog: rubric.catalog.map(RubricAreaResponse.fromArea),
    });
  }
}
