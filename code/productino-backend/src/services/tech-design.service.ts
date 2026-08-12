import { BadRequestException, Injectable } from '@nestjs/common';
import { PipelineRole, ProjectStage } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { projectTypeLabel, requiresTechDesign, resolveLanguage } from '../common/project-type';
import { BeliefNode, TechDesign, User } from '../entities';
import { BeliefNodeRepository, ProductDefinitionRepository, TechDesignRepository } from '../repository';
import { StructuredLlmService, TechDesignSchema, techDesignValidator } from '../llm';
import { ProjectService } from './project.service';
import { PipelineOrchestratorService } from './pipeline-orchestrator.service';
import { RubricService } from './rubric.service';

/**
 * The Tech Lead's stage — reads the confirmed product definition and hands back a
 * concrete architecture (framework/db/api/infra/libraries), critiqued once through a
 * Business-Analyst lens before being persisted. Skipped for pure-consulting project
 * types, which have nothing to architect.
 */
@Injectable()
export class TechDesignService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly productDefinitionRepository: ProductDefinitionRepository,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly techDesignRepository: TechDesignRepository,
    private readonly structuredLlmService: StructuredLlmService,
    private readonly orchestrator: PipelineOrchestratorService,
    private readonly rubricService: RubricService,
  ) {}

  async latest(projectId: number, user: User): Promise<TechDesign | null> {
    await this.projectService.getProjectForUser(projectId, user);
    return this.techDesignRepository.findLatestForProject(projectId);
  }

  async generate(projectId: number, user: User): Promise<TechDesign> {
    const project = await this.projectService.getProjectForUser(projectId, user); // enforces tenancy

    if (!requiresTechDesign(project.projectType)) {
      throw new BadRequestException(
        'This project type is a consulting engagement with nothing to architect — skip straight to delivery planning.',
      );
    }

    const definition = await this.productDefinitionRepository.findLatestForProject(projectId);
    if (!definition) {
      throw new BadRequestException('Generate a product definition before designing the architecture');
    }
    const content = (definition.content ?? {}) as Record<string, any>;

    const rubric = this.rubricService.forProject(project);
    const techKeys = new Set(rubric.filter((area) => area.owner === PipelineRole.TECH_LEAD).map((area) => area.key));
    const nodes = await this.beliefNodeRepository.findAllForProject(projectId);
    const technicalBeliefs = this.beliefsList(nodes.filter((node) => techKeys.has(node.coverageKey ?? '')));

    const { output } = await this.structuredLlmService.runWithValidation({
      promptKey: PromptKey.DESIGN_ARCHITECTURE,
      vars: {
        projectType: projectTypeLabel(project),
        language: resolveLanguage(project),
        summary: this.toText(content.summary),
        inScope: this.toBulletList(content.in_scope),
        uiSpec: this.uiSpecList(content.ui_spec),
        nonFunctional: this.toBulletList(content.non_functional),
        technicalBeliefs,
      },
      schema: TechDesignSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      semanticValidate: techDesignValidator,
      llmCritic: {
        step: 'design-architecture',
        criteria:
          '- Every field (frontend/backend/database/apiStyle/infra) has a concrete choice with a real rationale.\n' +
          '- No choice contradicts a stated constraint or non-functional requirement.\n' +
          '- The stack is coherent — the pieces actually work together, not a grab-bag of unrelated technology.',
        inputSummary: this.toText(content.summary),
        role: PipelineRole.BUSINESS_ANALYST,
      },
    });

    const version = (await this.techDesignRepository.countForProject(projectId)) + 1;
    const saved = await this.techDesignRepository.create({
      project: { connect: { id: projectId } },
      version,
      content: output,
      confidenceAtGeneration: definition.confidenceAtGeneration,
    } as any);

    // A new architecture makes any existing delivery plan and proposal stale.
    await this.orchestrator.advance(project.id, ProjectStage.TECH_DESIGN, 'techDesign');

    return saved;
  }

  private beliefsList(nodes: BeliefNode[]): string {
    if (!nodes.length) return '(none)';
    return nodes
      .map(
        (node) =>
          `- [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
          (node.description ? ` — ${node.description}` : ''),
      )
      .join('\n');
  }

  private toBulletList(value: any): string {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return items.map((item) => `- ${this.toText(item)}`).join('\n') || '(none)';
  }

  private uiSpecList(value: any): string {
    const screens = Array.isArray(value?.screens) ? value.screens : [];
    if (!screens.length) return '(no UI spec captured)';
    return screens.map((screen: any) => `- ${this.toText(screen?.name)}: ${this.toText(screen?.purpose)}`).join('\n');
  }

  private toText(value: any): string {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }
}
