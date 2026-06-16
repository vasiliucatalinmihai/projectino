import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class ExtractRequest {
  @ApiPropertyOptional({
    description: 'Source to extract from. Defaults to the project briefing when omitted.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  sourceId?: number;
}
