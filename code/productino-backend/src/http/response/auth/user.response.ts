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

  @ApiProperty({
    example: true,
    description: 'Inactive users cannot log in until they consume their activation link.',
  })
  active: boolean;

  @ApiPropertyOptional({
    example: 'a3f1c2…',
    nullable: true,
    description: 'Activation token (visible only to account admins / super admins).',
  })
  activationToken: string | null;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<UserResponse>) {
    Object.assign(this, partial);
  }

  /**
   * @param opts.activationToken — pass `false` to strip the token (e.g. when
   *   listing users for a viewer who shouldn't see other people's tokens).
   */
  static fromEntity(user: User, opts?: { activationToken?: boolean }): UserResponse {
    const includeToken = opts?.activationToken !== false;
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
      active: user.active,
      activationToken: includeToken ? user.activationToken : null,
      createdAt: user.createdAt,
    });
  }
}
