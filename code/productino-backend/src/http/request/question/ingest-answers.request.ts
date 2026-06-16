import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class IngestAnswersRequest {
  @ApiProperty({ description: "The client's free-text reply to paste back in" })
  @IsString()
  @MinLength(1)
  answers: string;
}
