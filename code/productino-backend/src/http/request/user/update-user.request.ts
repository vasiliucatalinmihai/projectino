import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserRequest {
  @ApiPropertyOptional({
    example: 2,
    description: 'Move the user to another account. Super admin only; ignored otherwise.',
  })
  @IsOptional()
  @IsInt()
  accountId?: number;

  @ApiPropertyOptional({ example: 'Renamed User' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: ['VIEW_ONLY', 'RUN_LLM'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({
    example: true,
    description: 'Toggle whether the user can log in. Inactive users are rejected at login.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
