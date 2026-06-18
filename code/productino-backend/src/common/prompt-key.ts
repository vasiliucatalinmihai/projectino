export enum PromptKey {
  EXTRACT_BELIEFS = 'extract-beliefs',
  SCORE_COVERAGE = 'score-coverage',
  MAP_ANSWERS = 'map-answers',
  SYNTHESIZE_PRD = 'synthesize-prd',
  DETECT_CONFLICTS = 'detect-conflicts',
  GENERATE_EPICS = 'generate-epics',
  GENERATE_EPIC_PLAN = 'generate-epic-plan',
  ESTIMATE_EPIC = 'estimate-epic',
  SYNTHESIZE_PROPOSAL = 'synthesize-proposal',
}

export interface PromptConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

/** What PromptManagerService.get() returns */
export interface RenderedPrompt {
  key: string;
  versionId: number;
  version: number;
  content: string;
  config: PromptConfig;
}

export interface PromptRunOutcome {
  success?: boolean;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  // The provider/model that served the run (from the LLM result).
  provider?: string;
  model?: string;
  score?: number;
  meta?: Record<string, any>;
}

export interface PromptRunContext {
  subjectType?: string;
  subjectId?: number;
}
