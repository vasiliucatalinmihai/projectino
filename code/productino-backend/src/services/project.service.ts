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

// Service-level inputs (no HTTP DTOs).
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

/** Token usage for a project, with a per-prompt (pipeline stage) breakdown. */
export interface ProjectTokenUsage extends TokenUsage {
  byPrompt: PromptTokenUsage[];
}

/** A project's effective rubric, whether it's customized, and the full catalog. */
export interface ProjectRubric {
  isCustom: boolean;
  areas: RubricArea[];
  catalog: RubricArea[];
}

// Load the briefing source alongside the project so `project.briefing` resolves.
const PROJECT_INCLUDE = {
  client: true,
  account: true,
  sources: { where: { kind: SourceKind.BRIEFING }, orderBy: { id: 'asc' as const }, take: 1 },
};

@Injectable()
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clients: ClientRepository,
    private readonly sources: SourceRepository,
    private readonly promptRuns: PromptRunRepository,
    private readonly rubric: RubricService,
  ) {}

  // Everyone is scoped to their own account; super admins reach other accounts
  // by impersonating them (impersonation swaps the account context).
  private scope(user: User): Record<string, any> {
    return { accountId: user.accountId };
  }

  findAll(user: User): Promise<Project[]> {
    return this.projects.findMany({
      where: this.scope(user),
      include: PROJECT_INCLUDE,
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number, user: User): Promise<Project> {
    const project = await this.projects.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });
    if (!project || project.accountId !== user.accountId) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  /** Resolve a client the user may use, enforcing account ownership. */
  private async resolveClient(clientId: number, user: User): Promise<Client> {
    const client = await this.clients.findById(clientId);
    if (!client || client.accountId !== user.accountId) {
      throw new BadRequestException(`Client ${clientId} not found in your account`);
    }
    return client;
  }

  async create(input: CreateProjectInput, user: User): Promise<Project> {
    // A project inherits its client's account, keeping the two in sync.
    const client = await this.resolveClient(input.clientId, user);
    const project = await this.projects.create({
      name: input.name,
      account: { connect: { id: client.accountId } },
      client: { connect: { id: client.id } },
    } as any);
    // The initial briefing becomes the first Source (round 1) of the Belief Graph.
    if (input.briefing) {
      await this.upsertBriefing(project.id, input.briefing);
    }
    return this.findOne(project.id, user);
  }

  async update(id: number, input: UpdateProjectInput, user: User): Promise<Project> {
    const project = await this.findOne(id, user); // enforces account ownership
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
      await this.projects.update(id, data);
    }
    if (briefing !== undefined) {
      await this.upsertBriefing(id, briefing);
    }
    return this.findOne(id, user);
  }

  async remove(id: number, user: User): Promise<Project> {
    const project = await this.findOne(id, user);
    await this.projects.delete(id); // cascades to the Belief Graph (sources, nodes, …)
    return project;
  }

  /** LLM token usage for a project, summed from its logged prompt runs. */
  async tokenUsage(id: number, user: User): Promise<ProjectTokenUsage> {
    await this.findOne(id, user); // enforces tenancy
    const [totals, byPrompt] = await Promise.all([
      this.promptRuns.tokenUsageForSubject('project', id),
      this.promptRuns.tokenUsageByPromptForSubject('project', id),
    ]);
    return { ...totals, byPrompt };
  }

  /** The project's effective discovery rubric (+ whether it's custom + the catalog). */
  async getRubric(id: number, user: User): Promise<ProjectRubric> {
    const project = await this.findOne(id, user); // enforces tenancy
    return this.buildRubric(project);
  }

  /**
   * Set (or clear, when `config` is null) the project's rubric override. A non-null
   * config is validated by RubricService; invalid input surfaces as a 400.
   */
  async setRubric(id: number, config: unknown | null, user: User): Promise<ProjectRubric> {
    await this.findOne(id, user); // enforces tenancy
    let value: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
    if (config != null) {
      try {
        value = this.rubric.normalizeConfig(config) as unknown as Prisma.InputJsonValue;
      } catch (error: any) {
        throw new BadRequestException(error?.message ?? 'Invalid rubric configuration');
      }
    }
    await this.projects.update(id, { rubric: value } as any);
    return this.buildRubric(await this.findOne(id, user));
  }

  private buildRubric(project: Project): ProjectRubric {
    return {
      isCustom: this.rubric.isCustom(project),
      areas: this.rubric.forProject(project),
      catalog: this.rubric.catalog(),
    };
  }

  /** Create or replace the project's BRIEFING source (the seed input). */
  private async upsertBriefing(projectId: number, briefing: string | null): Promise<void> {
    const existing = await this.sources.findBriefing(projectId);
    const content = briefing ?? '';
    if (existing) {
      await this.sources.update(existing.id, { content } as any);
    } else if (content) {
      await this.sources.create({
        project: { connect: { id: projectId } },
        kind: SourceKind.BRIEFING,
        content,
        round: 1,
      } as any);
    }
  }
}
