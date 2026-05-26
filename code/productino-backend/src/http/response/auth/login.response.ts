import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user.response';

export class LoginResponse {
  @ApiProperty({ description: 'JWT to send as `Authorization: Bearer <token>`' })
  accessToken: string;

  @ApiProperty({ type: UserResponse })
  user: UserResponse;

  constructor(partial: Partial<LoginResponse>) {
    Object.assign(this, partial);
  }
}
