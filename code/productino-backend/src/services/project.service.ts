import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStage, SourceKind } from '@prisma/client';
import {
  ClientRepository,
  ProjectRepository,
  PromptRunRepository,
  PromptTokenUsage,
  SourceRepository,
  TokenUsage,
} from '../repository';
import { Client, Project, User } from '../entities';
import { RubricArea, RubricService } from './rubric.service';

export interface CreateProjectInput {
  name: string;
  clientId: number;
  briefing?: string | null;
}
export interface UpdateProjectInput {
  name?: string;
  clientId?: number;
  briefing?: string | null;
  stage?: ProjectStage;
}

export interface ProjectTokenUsage extends TokenUsage {
  byPrompt: PromptTokenUsage[];
}

export interface ProjectRubric {
  isCustom: boolean;
  areas: RubricArea[];
  catalog: RubricArea[];
}

const PROJECT_INCLUDE = {
  client: true,
  account: true,
  sources: { where: { kind: SourceKind.BRIEFING }, orderBy: { id: 'asc' as const }, take: 1 },
};

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly clientRepository: ClientRepository,
    private readonly sourceRepository: SourceRepository,
    private readonly promptRunRepository: PromptRunRepository,
    private readonly rubricService: RubricService,
  ) {}

  private getAccountId(user: User): Record<string, any> {
    return { accountId: user.accountId };
  }

  public getAllProjectsForUser(user: User): Promise<Project[]> {
    return this.projectRepository.findMany({
      where: this.getAccountId(user),
      include: PROJECT_INCLUDE,
      orderBy: { id: 'desc' },
    });
  }

  async getProjectForUser(id: number, user: User): Promise<Project> {
    const project = await this.projectRepository.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });
    if (!project || project.accountId !== user.accountId) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  private async resolveClient(clientId: number, user: User): Promise<Client> {
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.accountId !== user.accountId) {
      throw new BadRequestException(`Client ${clientId} not found in your account`);
    }
    return client;
  }

  async create(input: CreateProjectInput, user: User): Promise<Project> {
    const client = await this.resolveClient(input.clientId, user);
    const project = await this.projectRepository.create({
      name: input.name,
      account: { connect: { id: client.accountId } },
      client: { connect: { id: client.id } },
    } as any);
    // The initial briefing becomes the first Source of the Belief Graph.
    if (input.briefing) {
      await this.upsertBriefing(project.id, input.briefing);
    }
    return this.getProjectForUser(project.id, user);
  }

  async update(id: number, input: UpdateProjectInput, user: User): Promise<Project> {
    const project = await this.getProjectForUser(id, user); // enforces account ownership
    const { briefing, clientId, ...rest } = input;
    const data: any = { ...rest };

    if (clientId !== undefined && clientId !== project.clientId) {
      const client = await this.resolveClient(clientId, user);
      if (client.accountId !== project.accountId) {
        throw new BadRequestException('Cannot move a project to a client in another account');
      }
      data.client = { connect: { id: client.id } };
    }

    if (Object.keys(data).length > 0) {
      await this.projectRepository.update(id, data);
    }
    if (briefing !== undefined) {
      await this.upsertBriefing(id, briefing);
    }
    return this.getProjectForUser(id, user);
  }

  async remove(id: number, user: User): Promise<Project> {
    const project = await this.getProjectForUser(id, user);
    await this.projectRepository.delete(id); // cascades to the Belief Graph (sources, nodes, …)
    return project;
  }

  /**
   *  LLM token usage for a project, summed from its logged prompt runs
   * @todo this is not by model (all mixed up)
   */
  async tokenUsage(id: number, user: User): Promise<ProjectTokenUsage> {
    await this.getProjectForUser(id, user); // enforces tenancy
    const [totals, byPrompt] = await Promise.all([
      this.promptRunRepository.tokenUsageForSubject('project', id),
      this.promptRunRepository.tokenUsageByPromptForSubject('project', id),
    ]);
    return { ...totals, byPrompt };
  }

  async getRubric(id: number, user: User): Promise<ProjectRubric> {
    const project = await this.getProjectForUser(id, user); // enforces tenancy
    return this.buildRubric(project);
  }

  async setRubric(id: number, config: unknown | null, user: User): Promise<ProjectRubric> {
    await this.getProjectForUser(id, user); // enforces tenancy
    let value: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
    if (config != null) {
      try {
        value = this.rubricService.normalizeConfig(config) as unknown as Prisma.InputJsonValue;
      } catch (error: any) {
        throw new BadRequestException(error?.message ?? 'Invalid rubric configuration');
      }
    }
    await this.projectRepository.update(id, { rubric: value } as any);
    return this.buildRubric(await this.getProjectForUser(id, user));
  }

  private buildRubric(project: Project): ProjectRubric {
    return {
      isCustom: this.rubricService.isCustom(project),
      areas: this.rubricService.forProject(project),
      catalog: this.rubricService.catalog(),
    };
  }

  private async upsertBriefing(projectId: number, briefing: string | null): Promise<void> {
    const existing = await this.sourceRepository.findBriefing(projectId);
    const content = briefing ?? '';
    if (existing) {
      await this.sourceRepository.update(existing.id, { content } as any);
    } else if (content) {
      await this.sourceRepository.create({
        project: { connect: { id: projectId } },
        kind: SourceKind.BRIEFING,
        content,
        round: 1,
      } as any);
    }
  }
}
