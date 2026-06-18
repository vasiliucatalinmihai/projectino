import { Injectable, NotFoundException } from '@nestjs/common';
import { ConflictStatus } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { BeliefNode, Conflict, User } from '../entities';
import { BeliefNodeRepository, ConflictRepository, ProjectRoundRepository } from '../repository';
import { DetectConflictsSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { GraphValidationService } from './graph-validation.service';

/**
 * Phase 6: detect contradictions between beliefs and keep them as first-class
 * Conflict rows. Re-detecting replaces the set (conflicts are derived).
 */
@Injectable()
export class ConflictService {
  constructor(
    private readonly projects: ProjectService,
    private readonly nodes: BeliefNodeRepository,
    private readonly conflicts: ConflictRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly structured: StructuredLlmService,
    private readonly graphValidation: GraphValidationService,
  ) {}

  async detect(projectId: number, user: User): Promise<Conflict[]> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const nodes = await this.nodes.findAllForProject(projectId);

    // Always refresh: clear the previous set first.
    await this.conflicts.deleteMany({ projectId });
    if (nodes.length < 2) return [];

    const nodeNames = nodes.map((node) => node.name);
    const { conflicts } = await this.structured.run({
      promptKey: PromptKey.DETECT_CONFLICTS,
      vars: { beliefsList: this.beliefsList(nodes) },
      schema: DetectConflictsSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => value.conflicts.length,
      // Referential integrity: both sides must name a real belief, else the
      // "conflict" is between things that don't exist. Repair, then drop leftovers.
      validate: (value) => {
        const dropped = value.conflicts.filter(
          (conflict) =>
            this.graphValidation.resolveBeliefRefs([conflict.beliefA, conflict.beliefB], nodeNames)
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

    const allRounds = await this.rounds.findAllForProject(projectId);
    const round = allRounds.length ? allRounds[allRounds.length - 1].index : 1;

    const created: Conflict[] = [];
    for (const conflict of conflicts) {
      // Drop conflicts that still reference a non-existent belief; normalize the
      // surviving ones to the canonical node names.
      const { resolved, unknown } = this.graphValidation.resolveBeliefRefs(
        [conflict.beliefA, conflict.beliefB],
        nodeNames,
      );
      if (unknown.length) continue;
      const beliefA = resolved.get(conflict.beliefA) ?? conflict.beliefA;
      const beliefB = resolved.get(conflict.beliefB) ?? conflict.beliefB;
      created.push(
        await this.conflicts.create({
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

  /** Toggle a conflict's status (open ↔ resolved). */
  async setStatus(
    projectId: number,
    conflictId: number,
    user: User,
    status: ConflictStatus,
  ): Promise<Conflict> {
    await this.projects.findOne(projectId, user);
    const conflict = await this.conflicts.findById(conflictId);
    if (!conflict || conflict.projectId !== projectId) {
      throw new NotFoundException(`Conflict ${conflictId} not found`);
    }
    return this.conflicts.update(conflictId, { status } as any);
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
