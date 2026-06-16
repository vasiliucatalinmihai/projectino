import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateDefinitionRequest {
  @ApiPropertyOptional({ description: 'Generate even if confidence is below the gate' })
  @IsOptional()
  @IsBoolean()
  override?: boolean;

  @ApiPropertyOptional({ description: 'Why the gate was overridden (recorded on the definition)' })
  @IsOptional()
  @IsString()
  overrideReason?: string;
}
