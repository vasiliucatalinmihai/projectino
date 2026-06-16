import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Account } from '../../../entities';

export class AccountResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Acme Agency' }) name: string;
  @ApiPropertyOptional({ example: 'acme', nullable: true }) slug: string | null;
  @ApiProperty({ example: false }) isSystem: boolean;
  @ApiProperty({ example: false, description: 'Use the account\'s own AI models when processing' })
  bringYourOwnAi: boolean;
  @ApiProperty({ example: 3 }) userCount: number;
  @ApiProperty() createdAt: Date;

  constructor(partial: Partial<AccountResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(account: Account, userCount = 0): AccountResponse {
    return new AccountResponse({
      id: account.id,
      name: account.name,
      slug: account.slug,
      isSystem: account.isSystem,
      bringYourOwnAi: account.bringYourOwnAi,
      userCount,
      createdAt: account.createdAt,
    });
  }
}
