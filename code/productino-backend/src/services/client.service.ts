import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientRepository, ProjectRepository } from '../repository';
import { Client, User } from '../entities';

// Service-level inputs/outputs (no HTTP DTOs).
export interface CreateClientInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}
export type UpdateClientInput = Partial<CreateClientInput>;

export interface ClientWithStats {
  client: Client;
  projectCount: number;
}

@Injectable()
export class ClientService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly projects: ProjectRepository,
  ) {}

  // Tenant scoping: super admins see all accounts; everyone else only their own.
  private scope(user: User): Record<string, any> {
    return user.isSuperAdmin ? {} : { accountId: user.accountId };
  }

  async findAll(user: User): Promise<ClientWithStats[]> {
    const clients = await this.clients.findMany({
      where: this.scope(user),
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      clients.map(async (client) => ({
        client,
        projectCount: await this.projects.count({ where: { clientId: client.id } }),
      })),
    );
  }

  /** Load a client, enforcing account ownership (super admin sees any). */
  async findOne(id: number, user: User): Promise<Client> {
    const client = await this.clients.findById(id);
    if (!client || (!user.isSuperAdmin && client.accountId !== user.accountId)) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async create(input: CreateClientInput, user: User): Promise<Client> {
    if (await this.clients.findByAccountAndName(user.accountId, input.name)) {
      throw new ConflictException(`A client named "${input.name}" already exists`);
    }
    return this.clients.create({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      account: { connect: { id: user.accountId } },
    } as any);
  }

  async update(id: number, input: UpdateClientInput, user: User): Promise<Client> {
    const client = await this.findOne(id, user); // enforces account ownership
    if (input.name && input.name !== client.name) {
      const clash = await this.clients.findByAccountAndName(client.accountId, input.name);
      if (clash && clash.id !== id) {
        throw new ConflictException(`A client named "${input.name}" already exists`);
      }
    }
    return this.clients.update(id, input as any);
  }

  async remove(id: number, user: User): Promise<Client> {
    const client = await this.findOne(id, user);
    const projectCount = await this.projects.count({ where: { clientId: id } });
    if (projectCount > 0) {
      throw new ConflictException(
        `Client has ${projectCount} project(s); reassign or delete them before removing the client`,
      );
    }
    await this.clients.delete(id);
    return client;
  }
}
