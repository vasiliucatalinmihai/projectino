import { Injectable } from '@nestjs/common';
import {
  BeliefNode,
  Conflict,
  CoverageArea,
  ProjectRound,
  Question,
  Source,
  User,
} from '../entities';
import {
  BeliefNodeRepository,
  ConflictRepository,
  CoverageAreaRepository,
  ProjectRoundRepository,
  QuestionRepository,
  SourceRepository,
} from '../repository';
import { ProjectService } from './project.service';

export interface ProjectGraph {
  projectId: number;
  sources: Source[];
  coverageAreas: CoverageArea[];
  nodes: BeliefNode[];
  questions: Question[];
  rounds: ProjectRound[];
  conflicts: Conflict[];
}

@Injectable()
export class BeliefGraphService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly sourceRepository: SourceRepository,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly coverageAreaRepository: CoverageAreaRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly projectRoundRepository: ProjectRoundRepository,
    private readonly conflictRepository: ConflictRepository,
  ) {}

  async forProject(projectId: number, user: User): Promise<ProjectGraph> {
    await this.projectService.findOne(projectId, user); // throws if not in the user's account

    const [sources, coverageAreas, nodes, questions, rounds, conflicts] = await Promise.all([
      this.sourceRepository.findAllForProject(projectId),
      this.coverageAreaRepository.findAllForProject(projectId),
      this.beliefNodeRepository.findAllForProject(projectId),
      this.questionRepository.findAllForProject(projectId),
      this.projectRoundRepository.findAllForProject(projectId),
      this.conflictRepository.findAllForProject(projectId),
    ]);

    return { projectId, sources, coverageAreas, nodes, questions, rounds, conflicts };
  }
}
