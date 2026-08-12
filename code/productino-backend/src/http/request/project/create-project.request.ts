import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectRequest {
  @ApiProperty({ example: 'Acme mobile app' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 1, description: 'Id of the client this project belongs to' })
  @IsInt()
  clientId: number;

  @ApiPropertyOptional({ enum: ProjectType, example: ProjectType.WEB, description: 'Kind of engagement — drives the default rubric and steers extraction/coverage/design prompts' })
  @IsOptional()
  @IsEnum(ProjectType)
  projectType?: ProjectType;

  @ApiPropertyOptional({ description: 'Free-text label when projectType is OTHER' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectTypeOtherLabel?: string;

  @ApiPropertyOptional({
    example: 'Romanian',
    description:
      'The language every LLM call should respond in, as its English name. Auto-detected from ' +
      'the briefing on first extraction if left unset — only set this to override detection.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;

  @ApiPropertyOptional({ description: 'Raw initial briefing text' })
  @IsOptional()
  @IsString()
  briefing?: string;
}
