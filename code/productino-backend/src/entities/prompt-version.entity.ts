import { PromptConfig } from '../common/prompt-key';
import { BaseEntity } from './base.entity';

export class PromptVersion extends BaseEntity {
  id: number;
  promptId: number;
  version: number;
  content: string;
  config: PromptConfig;
  checksum: string;
  source: string;
  notes: string | null;
  createdAt: Date;

  constructor(partial: Partial<PromptVersion>) {
    super(partial);
  }
}
