import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { User } from '../entities';
import { PIPELINE_QUEUE, PipelineJobData, PipelineStep, pipelineJobId } from '../common/pipeline-job';

export type PipelineJobStatus = 'queued' | 'active' | 'completed' | 'failed';

export interface EnqueuedJob {
  jobId: string;
  step: PipelineStep;
  status: PipelineJobStatus;
}

export interface PipelineJobStatusResult extends EnqueuedJob {
  error?: Record<string, any>;
}

const IN_FLIGHT_STATES = ['waiting', 'active', 'delayed'] as const;

/**
 * Producer + status-reader side of the pipeline job queue. Exclusivity comes from BullMQ's own
 * job-identity semantics (deterministic `${projectId}:${step}` id), not a separate lock — see
 * `src/consumers/pipeline.consumer.ts` for why `userId` is deliberately excluded from that id.
 */
@Injectable()
export class PipelineQueueService {
  constructor(@InjectQueue(PIPELINE_QUEUE) private readonly queue: Queue<PipelineJobData>) {}

  async enqueue(
    projectId: number,
    user: User,
    step: PipelineStep,
    params: Record<string, any> = {},
  ): Promise<EnqueuedJob> {
    const jobId = pipelineJobId(projectId, step);
    const existing = await this.queue.getJob(jobId);
    if (existing && (await this.isInFlight(existing))) {
      throw new ConflictException(`A "${step}" job is already running for this project.`);
    }

    await this.queue.add(
      'run-step',
      { step, projectId, userId: user.id, params },
      {
        jobId,
        // Transient failures (a 502/timeout from the provider) get retried at the job level,
        // on top of the per-HTTP-call retry already inside the LLM adapter — most single
        // timeouts self-heal here without the user ever seeing a failure.
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        // Belt-and-suspenders retention — the *real* cleanup is toResult() removing a job the
        // moment its terminal state is first read (see there for why), so these ages are just
        // a backstop for a job nobody ever polled for (e.g. the tab was closed immediately).
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );
    return { jobId, step, status: 'queued' };
  }

  async status(jobId: string): Promise<PipelineJobStatusResult | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    return this.toResult(job);
  }

  /** Any job (any step) currently in flight for a project — resumes polling after a page refresh. */
  async activeForProject(projectId: number): Promise<PipelineJobStatusResult | null> {
    const jobs = await this.queue.getJobs([...IN_FLIGHT_STATES]);
    const match = jobs.find((job) => job.data.projectId === projectId);
    return match ? this.status(pipelineJobId(projectId, match.data.step)) : null;
  }

  /**
   * BullMQ keeps a completed/failed job with a custom id around until something removes it —
   * re-`add()`ing the same id before that happens does not reliably start a fresh run (this is
   * exactly what silently broke retrying a failed job). So the moment a terminal state is first
   * observed here, remove it immediately — by the time this response reaches whoever's polling,
   * the id is already free for a genuine next attempt. `removeOnComplete`/`removeOnFail` above
   * are just a backstop for a job nobody ever polled for.
   */
  private async toResult(job: Job<PipelineJobData>): Promise<PipelineJobStatusResult> {
    const jobId = pipelineJobId(job.data.projectId, job.data.step);
    const state = await job.getState();
    if (state === 'completed') {
      await job.remove().catch(() => undefined);
      return { jobId, step: job.data.step, status: 'completed' };
    }
    if (state === 'failed') {
      const error = this.parseFailure(job.failedReason);
      await job.remove().catch(() => undefined);
      return { jobId, step: job.data.step, status: 'failed', error };
    }
    if (state === 'active') return { jobId, step: job.data.step, status: 'active' };
    return { jobId, step: job.data.step, status: 'queued' }; // waiting | delayed (incl. mid-retry-backoff) | ...
  }

  private async isInFlight(job: Job<PipelineJobData>): Promise<boolean> {
    const state = await job.getState();
    return (IN_FLIGHT_STATES as readonly string[]).includes(state);
  }

  private parseFailure(reason: string | undefined): Record<string, any> {
    if (!reason) return { message: 'Job failed' };
    try {
      return JSON.parse(reason);
    } catch {
      return { message: reason };
    }
  }
}
