import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnqueuedJobResponse {
  @ApiProperty({ example: '42-extract', description: 'Deterministic id — `${projectId}-${step}`' })
  jobId: string;

  @ApiProperty({ example: 'extract' })
  step: string;

  @ApiProperty({ example: 'queued', enum: ['queued', 'active', 'completed', 'failed'] })
  status: string;

  constructor(partial: Partial<EnqueuedJobResponse>) {
    Object.assign(this, partial);
  }
}

export class PipelineJobResponse extends EnqueuedJobResponse {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Present only when status is "failed" — the structured error payload the step threw',
  })
  error?: Record<string, any> | null;

  constructor(partial: Partial<PipelineJobResponse>) {
    super(partial);
    this.error = partial.error ?? null;
  }
}
