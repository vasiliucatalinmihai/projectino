import { BadRequestException, Injectable } from '@nestjs/common';
import { BeliefStatus, ProjectStage } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { RUBRIC_PROMPT_LIST } from '../common/rubric';
import { BeliefNode, Provenance, Source, User } from '../entities';
import { BeliefNodeRepository, ProjectRepository, SourceRepository } from '../repository';
import { ExtractBeliefsResult, ExtractBeliefsSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { PipelineResetService } from './pipeline-reset.service';
import { GraphValidationService } from './graph-validation.service';

/** Beyond this, an "ASSUMED" belief can't claim more certainty than a default. */
const UNGROUNDED_CONFIDENCE_CAP = 0.4;

type ExtractedBelief = ExtractBeliefsResult['beliefs'][number];

/**
 * Phase 2: turn a project Source into structured BeliefNodes (the Understanding
 * layer). The model output is validated + normalized by ExtractBeliefsSchema via
 * StructuredLlmService; this service only resolves the source, persists nodes,
 * and cascades. Re-running for the same round replaces that round's nodes.
 */
@Injectable()
export class ExtractionService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly sources: SourceRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly structured: StructuredLlmService,
    private readonly reset: PipelineResetService,
    private readonly graphValidation: GraphValidationService,
  ) {}

  /** Extract beliefs from a project source (defaults to the briefing) and persist them. */
  async run(projectId: number, user: User, sourceId?: number): Promise<BeliefNode[]> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const source = await this.resolveSource(projectId, sourceId);

    const { beliefs } = await this.structured.run({
      key: PromptKey.EXTRACT_BELIEFS,
      vars: { source: source.content, sourceKind: source.kind, rubricList: RUBRIC_PROMPT_LIST },
      schema: ExtractBeliefsSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => value.beliefs.length,
      // Anti-hallucination: every quote must be findable in the source. Unfound
      // quotes trigger a repair asking the model to re-quote verbatim.
      validate: (value) => this.gradeGrounding(value, source),
    });

    // Idempotent per round: replace any nodes previously extracted for this round.
    await this.nodes.deleteMany({ projectId, round: source.round });

    const created: BeliefNode[] = [];
    for (const belief of beliefs) {
      const grounded = this.ground(belief, source);
      created.push(
        await this.nodes.create({
          project: { connect: { id: project.id } },
          nodeType: belief.nodeType,
          kind: belief.kind,
          name: belief.name.slice(0, 200),
          description: belief.description,
          status: grounded.status,
          confidence: grounded.confidence,
          coverageKey: belief.coverageKey,
          provenance: grounded.provenance,
          round: source.round,
        } as any),
      );
    }

    // First extraction moves the project into analysis; don't regress later stages.
    if (project.stage === ProjectStage.BRIEFING) {
      await this.projectRepo.update(project.id, { stage: ProjectStage.GAP_ANALYSIS } as any);
    }

    // New beliefs make coverage/questions/conflicts and the whole delivery chain
    // stale — clear them (rounds + answered questions are preserved).
    await this.reset.afterExtraction(project.id);

    return created;
  }

  private async resolveSource(projectId: number, sourceId?: number): Promise<Source> {
    const source = sourceId
      ? await this.sources.findById(sourceId)
      : await this.sources.findBriefing(projectId);
    if (!source || source.projectId !== projectId) {
      throw new BadRequestException('No source to extract from');
    }
    if (!source.content?.trim()) {
      throw new BadRequestException('Source has no content to extract from');
    }
    return source;
  }

  /** Semantic check fed to the repair loop: are the beliefs' quotes real? */
  private gradeGrounding(value: ExtractBeliefsResult, source: Source) {
    const grading = this.graphValidation.gradeBeliefs(value.beliefs, source.content);
    const metrics = {
      groundingRate: grading.rate,
      graded: grading.graded,
      grounded: grading.grounded,
      ungrounded: grading.ungrounded.length,
    };
    if (!grading.ungrounded.length) return { ok: true, metrics };
    const names = grading.ungrounded.slice(0, 8).map((name) => `"${name}"`).join(', ');
    return {
      ok: false,
      metrics,
      repairMessage:
        `${grading.ungrounded.length} belief quote(s) were NOT found in the SOURCE: ${names}. ` +
        'For each, copy the exact supporting text verbatim from the SOURCE into "quote", ' +
        'or set "quote" to "" and make the belief ASSUMED.',
    };
  }

  /**
   * Ground one belief against its source. A quote that's found yields a real
   * provenance entry (with a span for exact/normalized matches). A quote that
   * can't be found is treated as unsupported: the belief is downgraded to
   * ASSUMED with capped confidence and flagged, never silently kept as stated.
   */
  private ground(
    belief: ExtractedBelief,
    source: Source,
  ): { status: BeliefStatus; confidence: number; provenance: Provenance[] } {
    const quote = (belief.quote ?? '').trim();
    // No quote = a legitimately unsourced default (ASSUMED); leave it as-is.
    if (!quote) {
      return { status: belief.status as BeliefStatus, confidence: belief.confidence, provenance: [] };
    }

    const location = this.graphValidation.locateQuote(quote, source.content);
    if (location.match === 'none') {
      return {
        status: BeliefStatus.ASSUMED,
        confidence: Math.min(belief.confidence, UNGROUNDED_CONFIDENCE_CAP),
        provenance: [{ sourceId: source.id, quote, grounded: false, match: 'none' }],
      };
    }

    const entry: Provenance = { sourceId: source.id, quote, grounded: true, match: location.match };
    if (location.span) entry.span = location.span;
    return { status: belief.status as BeliefStatus, confidence: belief.confidence, provenance: [entry] };
  }
}
