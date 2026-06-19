import { Injectable, NotFoundException } from '@nestjs/common';
import { ConflictStatus } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { BeliefNode, Conflict, User } from '../entities';
import { BeliefNodeRepository, ConflictRepository, ProjectRoundRepository } from '../repository';
import { DetectConflictsSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { GraphValidationService } from './graph-validation.service';

@Injectable()
export class ConflictService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly conflictRepository: ConflictRepository,
    private readonly projectRoundRepository: ProjectRoundRepository,
    private readonly llmService: StructuredLlmService,
    private readonly graphValidationService: GraphValidationService,
  ) {}

  async detect(projectId: number, user: User): Promise<Conflict[]> {
    const project = await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const nodes = await this.beliefNodeRepository.findAllForProject(projectId);

    await this.conflictRepository.deleteMany({ projectId });
    if (nodes.length < 2) return [];

    const nodeNames = nodes.map((node) => node.name);
    const { conflicts } = await this.llmService.run({
      promptKey: PromptKey.DETECT_CONFLICTS,
      vars: { beliefsList: this.beliefsList(nodes) },
      schema: DetectConflictsSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => value.conflicts.length,
      validate: (value) => {
        const dropped = value.conflicts.filter(
          (conflict) =>
            this.graphValidationService.resolveBeliefRefs([conflict.beliefA, conflict.beliefB], nodeNames)
              .unknown.length > 0,
        ).length;
        const metrics = { conflicts: value.conflicts.length, droppedConflicts: dropped };
        if (dropped > 0) {
          return {
            ok: false,
            metrics,
            repairMessage:
              `${dropped} conflict(s) reference beliefs not in the list. Reference each side ` +
              'only by a belief name exactly as written in the BELIEFS list above.',
          };
        }
        return { ok: true, metrics };
      },
    });

    const allRounds = await this.projectRoundRepository.findAllForProject(projectId);
    const round = allRounds.length ? allRounds[allRounds.length - 1].index : 1;

    const created: Conflict[] = [];
    for (const conflict of conflicts) {
      // Drop conflicts that still reference a non-existent belief; normalize the surviving ones
      const { resolved, unknown } = this.graphValidationService.resolveBeliefRefs(
        [conflict.beliefA, conflict.beliefB],
        nodeNames,
      );
      if (unknown.length) continue;
      const beliefA = resolved.get(conflict.beliefA) ?? conflict.beliefA;
      const beliefB = resolved.get(conflict.beliefB) ?? conflict.beliefB;
      created.push(
        await this.conflictRepository.create({
          project: { connect: { id: projectId } },
          summary: conflict.summary.slice(0, 200),
          detail: conflict.detail,
          beliefA: beliefA.slice(0, 300),
          beliefB: beliefB.slice(0, 300),
          status: ConflictStatus.OPEN,
          round,
        } as any),
      );
    }
    return created;
  }

  async setStatus( projectId: number, conflictId: number, user: User, status: ConflictStatus): Promise<Conflict> {
    await this.projectService.getProjectForUser(projectId, user);
    const conflict = await this.conflictRepository.findById(conflictId);
    if (!conflict || conflict.projectId !== projectId) {
      throw new NotFoundException(`Conflict ${conflictId} not found`);
    }
    return this.conflictRepository.update(conflictId, { status } as any);
  }

  private beliefsList(nodes: BeliefNode[]): string {
    return nodes
      .map(
        (node) =>
          `- [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
          (node.description ? ` — ${node.description}` : ''),
      )
      .join('\n');
  }
}
