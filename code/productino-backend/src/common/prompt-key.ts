/**
 * Stable identifiers for prompts. The value matches the `key` frontmatter in the
 * corresponding `src/prompts/<key>.md` file and the `prompts.key` DB column.
 * Prefer these over class names so refactors don't silently break lookups.
 */
export enum PromptKey {
  // Belief Graph pipeline keys are added per phase (Phase 2+):
  //   EXTRACT_BELIEFS = 'extract-beliefs',
  //   SCORE_COVERAGE  = 'score-coverage',
  //   MAP_ANSWERS     = 'map-answers',
  //   SYNTHESIZE_PRD  = 'synthesize-prd',
}

/** Model/runtime config stored alongside each prompt version (from frontmatter). */
export interface PromptConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

/** What PromptManagerService.get() returns: a rendered prompt + the version it came from. */
export interface RenderedPrompt {
  key: string;
  versionId: number;
  version: number;
  content: string;
  config: PromptConfig;
}

/** Outcome of an LLM call, logged against the prompt version via recordOutcome(). */
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

/** Optional subject a run is attributed to (e.g. the project it was run for). */
export interface PromptRunContext {
  subjectType?: string;
  subjectId?: number;
}
