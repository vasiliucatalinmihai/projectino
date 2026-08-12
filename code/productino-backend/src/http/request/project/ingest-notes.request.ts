import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { SourceKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IngestNotesRequest {
  @ApiProperty({ description: 'Free-text notes — e.g. a call/meeting summary with the client' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    enum: [SourceKind.TRANSCRIPT, SourceKind.EMAIL],
    default: SourceKind.TRANSCRIPT,
    description: 'What kind of extra info this is',
  })
  @IsOptional()
  @IsEnum([SourceKind.TRANSCRIPT, SourceKind.EMAIL])
  kind?: typeof SourceKind.TRANSCRIPT | typeof SourceKind.EMAIL;

  @ApiPropertyOptional({ description: 'Optional label, e.g. "Call with John, 03/15"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
