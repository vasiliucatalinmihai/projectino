import { Account } from './account.entity';
import { BaseEntity } from './base.entity';
import { Project } from './project.entity';

export class Client extends BaseEntity {
  id: number;
  accountId: number;
  account?: Account;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  projects?: Project[];
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Client>) {
    super(partial);
  }
}
