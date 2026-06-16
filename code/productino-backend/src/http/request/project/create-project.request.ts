import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectRequest {
  @ApiProperty({ example: 'Acme mobile app' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 1, description: 'Id of the client this project belongs to' })
  @IsInt()
  clientId: number;

  @ApiPropertyOptional({ description: 'Raw initial briefing text' })
  @IsOptional()
  @IsString()
  briefing?: string;
}
