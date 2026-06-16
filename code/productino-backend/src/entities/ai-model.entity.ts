import { Account } from './account.entity';
import { BaseEntity } from './base.entity';

export class AiModel extends BaseEntity {
  id: number;
  accountId: number;
  account?: Account;
  label: string | null;
  provider: string;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  options: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<AiModel>) {
    super(partial);
  }

  /** Never expose the raw key; show only a masked hint. */
  get keyHint(): string | null {
    if (!this.apiKey) return null;
    const tail = this.apiKey.slice(-4);
    return `••••${tail}`;
  }

  get hasKey(): boolean {
    return !!this.apiKey;
  }
}
