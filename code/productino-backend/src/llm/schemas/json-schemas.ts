import { PromptKey } from '../../common/prompt-key';

/**
 * Compact JSON Schemas describing each prompt's expected output. Used as the
 * input_schema for Anthropic tool-use (strict structured output). These are a
 * model-facing contract/hint — Zod (pipeline-schemas) remains the authoritative
 * validator, so they're kept lenient (no additionalProperties constraints).
 */
export interface JsonSchemaSpec {
  name: string;
  description: string;
  schema: Record<string, any>;
}

const string = { type: 'string' };
const stringArray = { type: 'array', items: { type: 'string' } };

export const JSON_SCHEMAS: Partial<Record<string, JsonSchemaSpec>> = {
  [PromptKey.EXTRACT_BELIEFS]: {
    name: 'emit_beliefs',
    description: 'Return the belief nodes extracted from the source.',
    schema: {
      type: 'object',
      properties: {
        beliefs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeType: { type: 'string', enum: ['REQUIREMENT', 'ASSUMPTION', 'RISK', 'DECISION'] },
              kind: { type: 'string' },
              name: string,
              description: string,
              status: { type: 'string', enum: ['STATED', 'INFERRED', 'ASSUMED'] },
              confidence: { type: 'number' },
              coverageKey: string,
              quote: string,
            },
            required: ['name', 'nodeType', 'status'],
          },
        },
      },
      required: ['beliefs'],
    },
  },

  [PromptKey.SCORE_COVERAGE]: {
    name: 'emit_coverage',
    description: 'Return per-rubric-area coverage scores and clarifying questions.',
    schema: {
      type: 'object',
      properties: {
        areas: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: string, rollupConfidence: { type: 'number' }, summary: string },
            required: ['key', 'rollupConfidence'],
          },
        },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              coverageKey: string,
              text: string,
              assumedAnswer: string,
              impact: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            },
            required: ['text'],
          },
        },
      },
      required: ['areas', 'questions'],
    },
  },

  [PromptKey.MAP_ANSWERS]: {
    name: 'emit_answer_mapping',
    description: 'Map the client reply onto the open questions.',
    schema: {
      type: 'object',
      properties: {
        mapped: {
          type: 'array',
          items: {
            type: 'object',
            properties: { questionId: { type: 'integer' }, answer: string },
            required: ['questionId', 'answer'],
          },
        },
        notes: string,
      },
      required: ['mapped'],
    },
  },

  [PromptKey.SYNTHESIZE_PRD]: {
    name: 'emit_prd',
    description: 'Return the structured product definition.',
    schema: {
      type: 'object',
      properties: {
        summary: string,
        in_scope: stringArray,
        out_of_scope: stringArray,
        non_functional: stringArray,
        assumptions: stringArray,
        user_stories: {
          type: 'array',
          items: {
            type: 'object',
            properties: { role: string, story: string, acceptance_criteria: stringArray },
            required: ['story'],
          },
        },
        risks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: string,
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              mitigation: string,
            },
            required: ['description'],
          },
        },
      },
      required: ['summary'],
    },
  },

  [PromptKey.DETECT_CONFLICTS]: {
    name: 'emit_conflicts',
    description: 'Return contradictions between beliefs (empty list if none).',
    schema: {
      type: 'object',
      properties: {
        conflicts: {
          type: 'array',
          items: {
            type: 'object',
            properties: { beliefA: string, beliefB: string, summary: string, detail: string },
            required: ['beliefA', 'beliefB', 'detail'],
          },
        },
      },
      required: ['conflicts'],
    },
  },

  [PromptKey.GENERATE_EPICS]: {
    name: 'emit_epics',
    description: 'Return the major epics for the project.',
    schema: {
      type: 'object',
      properties: {
        epics: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: string, description: string },
            required: ['title'],
          },
        },
      },
      required: ['epics'],
    },
  },

  [PromptKey.GENERATE_EPIC_PLAN]: {
    name: 'emit_epic_plan',
    description: 'Return the stories and estimated tasks for one epic.',
    schema: {
      type: 'object',
      properties: {
        stories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: string,
              description: string,
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: string,
                    description: string,
                    estimateLow: { type: 'integer' },
                    estimateHigh: { type: 'integer' },
                    phase: string,
                  },
                  required: ['title'],
                },
              },
            },
            required: ['title', 'tasks'],
          },
        },
      },
      required: ['stories'],
    },
  },

  [PromptKey.SYNTHESIZE_PROPOSAL]: {
    name: 'emit_proposal_prose',
    description: 'Return the client-facing proposal prose.',
    schema: {
      type: 'object',
      properties: {
        intro: string,
        closing: string,
        phases: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: string, narrative: string },
            required: ['name', 'narrative'],
          },
        },
      },
      required: ['intro'],
    },
  },
};

export function jsonSchemaFor(key: string): JsonSchemaSpec | undefined {
  return JSON_SCHEMAS[key];
}
