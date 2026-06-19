import { BadRequestException, Injectable } from '@nestjs/common';
import { BeliefStatus, ProjectStage } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { BeliefNode, Provenance, Source, User } from '../entities';
import { BeliefNodeRepository, ProjectRepository, SourceRepository } from '../repository';
import { ExtractBeliefsResult, ExtractBeliefsSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { PipelineResetService } from './pipeline-reset.service';
import { GraphValidationService } from './graph-validation.service';
import { RubricService } from './rubric.service';

/** "ASSUMED" belief can't claim more certainty than a default. */
const UNGROUNDED_CONFIDENCE_CAP = 0.4;

type ExtractedBelief = ExtractBeliefsResult['beliefs'][number];

@Injectable()
export class ExtractionService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly projectRepository: ProjectRepository,
    private readonly sourceRepository: SourceRepository,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly llmService: StructuredLlmService,
    private readonly resetService: PipelineResetService,
    private readonly graphValidation: GraphValidationService,
    private readonly rubricService: RubricService,
  ) {}

  /** Extract beliefs from a project source (defaults to the briefing) and persist them. */
  async run(projectId: number, user: User, sourceId?: number): Promise<BeliefNode[]> {
    const project = await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const source = await this.resolveSource(projectId, sourceId);

    const { beliefs } = await this.llmService.run({
      promptKey: PromptKey.EXTRACT_BELIEFS,
      vars: {
        source: source.content,
        sourceKind: source.kind,
        rubricList: this.rubricService.promptList(this.rubricService.forProject(project)),
      },
      schema: ExtractBeliefsSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => value.beliefs.length,
      // Anti-hallucination: every quote must be findable in the source. Unfound
      // quotes trigger a repair asking the model to re-quote verbatim.
      validate: (value) => this.gradeGrounding(value, source),
    });

    await this.beliefNodeRepository.deleteMany({ projectId, round: source.round });

    const created: BeliefNode[] = [];
    for (const belief of beliefs) {
      const grounded = this.ground(belief, source);
      created.push(
        await this.beliefNodeRepository.create({
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

    if (project.stage === ProjectStage.BRIEFING) {
      await this.projectRepository.update(project.id, { stage: ProjectStage.GAP_ANALYSIS } as any);
    }

    await this.resetService.afterExtraction(project.id);

    return created;
  }

  private async resolveSource(projectId: number, sourceId?: number): Promise<Source> {
    const source = sourceId
      ? await this.sourceRepository.findById(sourceId)
      : await this.sourceRepository.findBriefing(projectId);
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
