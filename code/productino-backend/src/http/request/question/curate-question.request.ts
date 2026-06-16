import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CurateQuestionRequest {
  @ApiPropertyOptional({ enum: QuestionStatus, description: 'Include / exclude / answered state' })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({ description: 'Edited question text' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Edited assumed answer' })
  @IsOptional()
  @IsString()
  assumedAnswer?: string | null;
}
