import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../../entities';

export class UserAccountResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Acme Agency' }) name: string;
  @ApiProperty({ example: false }) isSystem: boolean;
}

export class UserResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin@productino.local' })
  email: string;

  @ApiPropertyOptional({ example: 'Admin', nullable: true })
  name: string | null;

  @ApiProperty({ example: 1 })
  accountId: number;

  @ApiPropertyOptional({ type: UserAccountResponse, nullable: true })
  account: UserAccountResponse | null;

  @ApiProperty({ example: ['ADMIN'], type: [String] })
  permissions: string[];

  @ApiProperty({ example: false })
  isSuperAdmin: boolean;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<UserResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(user: User): UserResponse {
    return new UserResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId,
      account: user.account
        ? { id: user.account.id, name: user.account.name, isSystem: user.account.isSystem }
        : null,
      permissions: user.permissionKeys,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
    });
  }
}
