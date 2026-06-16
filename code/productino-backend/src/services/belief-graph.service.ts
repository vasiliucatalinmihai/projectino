import { Injectable } from '@nestjs/common';
import { BeliefNode, CoverageArea, ProjectRound, Question, Source, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProjectRoundRepository,
  QuestionRepository,
  SourceRepository,
} from '../repository';
import { ProjectService } from './project.service';

/** All layers of a project's Belief Graph, loaded together. */
export interface ProjectGraph {
  projectId: number;
  sources: Source[];
  coverageAreas: CoverageArea[];
  nodes: BeliefNode[];
  questions: Question[];
  rounds: ProjectRound[];
}

/**
 * Read-only access to a project's Belief Graph (Phase 1). Extraction, scoring
 * and the convergence loop that populate these tables arrive in later phases;
 * for now this assembles whatever exists (empty until then).
 */
@Injectable()
export class BeliefGraphService {
  constructor(
    private readonly projects: ProjectService,
    private readonly sources: SourceRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly coverage: CoverageAreaRepository,
    private readonly questions: QuestionRepository,
    private readonly rounds: ProjectRoundRepository,
  ) {}

  /** Assemble the full graph for a project, enforcing tenancy via ProjectService. */
  async forProject(projectId: number, user: User): Promise<ProjectGraph> {
    await this.projects.findOne(projectId, user); // throws if not in the user's account

    const [sources, coverageAreas, nodes, questions, rounds] = await Promise.all([
      this.sources.findAllForProject(projectId),
      this.coverage.findAllForProject(projectId),
      this.nodes.findAllForProject(projectId),
      this.questions.findAllForProject(projectId),
      this.rounds.findAllForProject(projectId),
    ]);

    return { projectId, sources, coverageAreas, nodes, questions, rounds };
  }
}
