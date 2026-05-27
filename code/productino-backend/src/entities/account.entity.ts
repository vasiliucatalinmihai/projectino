import { BaseEntity } from './base.entity';

export class Account extends BaseEntity {
  id: number;
  name: string;
  slug: string | null;
  isSystem: boolean;
  bringYourOwnAi: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Account>) {
    super(partial);
  }
}
