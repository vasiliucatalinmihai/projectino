import { ApiProperty } from '@nestjs/swagger';
import { ConflictStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ResolveConflictRequest {
  @ApiProperty({ enum: ConflictStatus, description: 'OPEN or RESOLVED' })
  @IsEnum(ConflictStatus)
  status: ConflictStatus;
}
