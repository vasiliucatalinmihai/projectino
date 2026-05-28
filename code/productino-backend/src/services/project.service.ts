import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectStage } from '@prisma/client';
import { ClientRepository, ProjectRepository } from '../repository';
import { Client, Project, User } from '../entities';

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

@Injectable()
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clients: ClientRepository,
  ) {}

  // Tenant scoping: super admins see all accounts; everyone else only their own.
  private scope(user: User): Record<string, any> {
    return user.isSuperAdmin ? {} : { accountId: user.accountId };
  }

  findAll(user: User): Promise<Project[]> {
    return this.projects.findMany({
      where: this.scope(user),
      include: { client: true, account: true },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number, user: User): Promise<Project> {
    const project = await this.projects.findUnique({
      where: { id },
      include: { client: true, account: true },
    });
    if (!project || (!user.isSuperAdmin && project.accountId !== user.accountId)) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  /** Resolve a client the user may use, enforcing account ownership. */
  private async resolveClient(clientId: number, user: User): Promise<Client> {
    const client = await this.clients.findById(clientId);
    if (!client || (!user.isSuperAdmin && client.accountId !== user.accountId)) {
      throw new BadRequestException(`Client ${clientId} not found in your account`);
    }
    return client;
  }

  async create(input: CreateProjectInput, user: User): Promise<Project> {
    // A project inherits its client's account, keeping the two in sync.
    const client = await this.resolveClient(input.clientId, user);
    const project = await this.projects.create({
      name: input.name,
      briefing: input.briefing ?? null,
      account: { connect: { id: client.accountId } },
      client: { connect: { id: client.id } },
    } as any);
    return this.findOne(project.id, user);
  }

  async update(id: number, input: UpdateProjectInput, user: User): Promise<Project> {
    const project = await this.findOne(id, user); // enforces account ownership
    const data: any = { ...input };

    if (input.clientId !== undefined && input.clientId !== project.clientId) {
      const client = await this.resolveClient(input.clientId, user);
      if (client.accountId !== project.accountId) {
        throw new BadRequestException('Cannot move a project to a client in another account');
      }
      delete data.clientId;
      data.client = { connect: { id: client.id } };
    } else {
      delete data.clientId;
    }

    await this.projects.update(id, data);
    return this.findOne(id, user);
  }

  async remove(id: number, user: User): Promise<Project> {
    const project = await this.findOne(id, user);
    await this.projects.delete(id);
    return project;
  }
}
