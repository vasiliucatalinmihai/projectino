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
  // Lifetime usage, accrued per LLM call.
  runCount: number;
  tokensIn: number;
  tokensOut: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  get totalTokens(): number {
    return (this.tokensIn ?? 0) + (this.tokensOut ?? 0);
  }

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
