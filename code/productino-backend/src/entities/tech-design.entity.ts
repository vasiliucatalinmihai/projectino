import { BaseEntity } from './base.entity';

export interface StackChoice {
  choice?: string;
  rationale?: string;
}

export interface TechDesignContent {
  frontend?: StackChoice;
  backend?: StackChoice;
  database?: StackChoice;
  apiStyle?: StackChoice;
  infra?: StackChoice;
  keyLibraries?: Array<{ name: string; purpose?: string }>;
  risks?: string[];
  [key: string]: any;
}

export class TechDesign extends BaseEntity {
  id: number;
  projectId: number;
  version: number;
  content: TechDesignContent;
  confidenceAtGeneration: number;
  createdAt: Date;

  constructor(partial: Partial<TechDesign>) {
    super(partial);
  }
}
