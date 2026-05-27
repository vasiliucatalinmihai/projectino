import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Setting } from '../../../entities';

export class SettingResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  accountId: number;

  @ApiProperty({ example: 'default_currency' })
  key: string;

  @ApiProperty({ example: 'EUR' })
  value: string;

  @ApiPropertyOptional({ example: 'Currency used in proposals & estimates', nullable: true })
  description: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<SettingResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(setting: Setting): SettingResponse {
    return new SettingResponse({
      id: setting.id,
      accountId: setting.accountId,
      key: setting.key,
      value: setting.value,
      description: setting.description,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    });
  }
}
