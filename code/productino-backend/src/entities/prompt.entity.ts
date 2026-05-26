import { BaseEntity } from './base.entity';

export class Prompt extends BaseEntity {
  id: number;
  key: string;
  description: string | null;
  activeVersionId: number | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Prompt>) {
    super(partial);
  }
}
