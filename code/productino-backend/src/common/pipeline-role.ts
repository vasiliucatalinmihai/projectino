import { PipelineRole } from '@prisma/client';

/** Persona framing injected into prompts and the critic, keyed by pipeline role. */
export const PIPELINE_ROLE_LABEL: Record<PipelineRole, string> = {
  [PipelineRole.BUSINESS_ANALYST]: 'Business Analyst',
  [PipelineRole.TECH_LEAD]: 'Tech Lead',
};

export const PIPELINE_ROLE_DESCRIPTION: Record<PipelineRole, string> = {
  [PipelineRole.BUSINESS_ANALYST]:
    'You own functional scope, business rules, workflows, roles, UX and acceptance — the ' +
    'client-facing "what" and "why" of the product, not how it gets built.',
  [PipelineRole.TECH_LEAD]:
    'You own data, integrations, non-functional requirements, compliance, platforms and ' +
    'operations — the technical "how", and whether the functional ask is buildable as described.',
};
