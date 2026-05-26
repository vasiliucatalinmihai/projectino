import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../../entities';

export class UserResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin@productino.local' })
  email: string;

  @ApiPropertyOptional({ example: 'Admin', nullable: true })
  name: string | null;

  @ApiProperty({ example: ['ADMIN'], type: [String] })
  permissions: string[];

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
      permissions: user.permissionKeys,
      createdAt: user.createdAt,
    });
  }
}
