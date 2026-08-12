import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PIPELINE_QUEUE, PipelineJobData, PipelineStep } from '../common/pipeline-job';
import { UserRepository } from '../repository';
import {
  AnswerService,
  ConflictService,
  CoverageService,
  DefinitionService,
  DeliveryService,
  ExtractionService,
  ProposalService,
  TechDesignService,
} from '../services';

/**
 * Runs every LLM-calling pipeline step in the background. One queue, one consumer, a `step`
 * discriminator dispatching to the exact same service methods the controllers used to call
 * directly — only the transport changed (see docker/nginx timeout fix + async-jobs plan).
 *
 * No lock here: the job's id (`${projectId}-${step}`) is what BullMQ uses to guarantee only one
 * job for that project+step can be waiting/active at a time, so exclusivity is already handled
 * before a job ever reaches this consumer.
 *
 * BullMQ retries a failed job (transient provider timeouts/502s) up to 3 attempts — see
 * `PipelineQueueService.enqueue()` — by calling `process()` again from scratch. Every step here
 * is safe to fully re-run when it fails at its *first* LLM call (the common case, before any DB
 * write happens), but isn't strictly idempotent if a later call within the same step fails after
 * an earlier one already wrote something (e.g. `AnswerService.processExtraInfo` creating its
 * Source row before extraction runs) — a retry there re-does that write rather than resuming.
 * Worth revisiting if that turns out to matter in practice; out of scope for now.
 */
@Processor(PIPELINE_QUEUE, { concurrency: 5 })
export class PipelineConsumer extends WorkerHost {
  private readonly logger = new Logger(PipelineConsumer.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly extraction: ExtractionService,
    private readonly coverage: CoverageService,
    private readonly answers: AnswerService,
    private readonly conflicts: ConflictService,
    private readonly definition: DefinitionService,
    private readonly techDesign: TechDesignService,
    private readonly delivery: DeliveryService,
    private readonly proposals: ProposalService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<{ ok: true }> {
    const { step, projectId, userId, params } = job.data;

    // Permission checks already happened at enqueue time via @RequirePermissions on the HTTP
    // controller — this is only for the tenancy checks the services already do internally.
    const user = await this.userRepository.findByIdWithPermissions(userId);
    if (!user) throw new Error(JSON.stringify({ message: `User ${userId} not found` }));

    try {
      await this.runStep(step, projectId, user, params ?? {});
      return { ok: true };
    } catch (exception: any) {
      // Preserve structured exception payloads (e.g. the definition confidence-gate error:
      // { message, gate, rollupConfidence, threshold }) through BullMQ's failedReason (a plain
      // string) so the status endpoint can hand the same shape back to the frontend.
      const payload = exception?.getResponse?.() ?? { message: exception?.message ?? String(exception) };
      this.logger.warn(`Pipeline job ${job.id} (${step}, project ${projectId}) failed: ${JSON.stringify(payload).slice(0, 300)}`);
      throw new Error(JSON.stringify(payload));
    }
  }

  private async runStep(step: PipelineStep, projectId: number, user: any, params: Record<string, any>): Promise<void> {
    switch (step) {
      case 'extract':
        await this.extraction.run(projectId, user, params.sourceId);
        return;
      case 'score':
        await this.coverage.run(projectId, user);
        return;
      case 'answers':
        await this.answers.processAnswersText(projectId, user, params.answersText);
        return;
      case 'notes':
        await this.answers.processExtraInfo(projectId, user, params.content, params.kind, params.label);
        return;
      case 'conflicts':
        await this.conflicts.detect(projectId, user);
        return;
      case 'definition':
        await this.definition.generate(projectId, user, {
          override: params.override,
          overrideReason: params.overrideReason,
        });
        return;
      case 'tech-design':
        await this.techDesign.generate(projectId, user);
        return;
      case 'delivery':
        await this.delivery.generate(projectId, user);
        return;
      case 'proposal':
        await this.proposals.generate(projectId, user);
        return;
    }
  }
}
