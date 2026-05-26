import { BaseEntity } from './base.entity';

export class Setting extends BaseEntity {
  id: number;
  key: string;
  value: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Setting>) {
    super(partial);
  }
}
