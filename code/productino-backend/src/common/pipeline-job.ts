
export const PIPELINE_QUEUE = 'pipeline';

export type PipelineStep =
  | 'extract'
  | 'score'
  | 'answers'
  | 'notes'
  | 'conflicts'
  | 'definition'
  | 'tech-design'
  | 'delivery'
  | 'proposal';

export interface PipelineJobData {
  step: PipelineStep;
  projectId: number;
  userId: number;
  params?: Record<string, any>;
}

export function pipelineJobId(projectId: number, step: PipelineStep): string {
  return `${projectId}-${step}`;
}
