import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAccountRequest } from './create-account.request';

export class UpdateAccountRequest extends PartialType(CreateAccountRequest) {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the account uses its own AI models (super admin only)',
  })
  @IsOptional()
  @IsBoolean()
  bringYourOwnAi?: boolean;
}
