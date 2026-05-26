import { BaseEntity } from './base.entity';

export class Permission extends BaseEntity {
  id: number;
  key: string;
  description: string | null;
  createdAt: Date;

  constructor(partial: Partial<Permission>) {
    super(partial);
  }
}
