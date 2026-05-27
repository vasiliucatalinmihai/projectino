import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientRepository, ProjectRepository } from '../repository';
import { Client, User } from '../entities';
import { ClientResponse } from '../http/response/client';
import { CreateClientRequest, UpdateClientRequest } from '../http/request/client';

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

  async findAll(user: User): Promise<ClientResponse[]> {
    const clients = await this.clients.findMany({
      where: this.scope(user),
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      clients.map(async (c) =>
        ClientResponse.fromEntity(c, await this.projects.count({ where: { clientId: c.id } })),
      ),
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

  async create(body: CreateClientRequest, user: User): Promise<Client> {
    if (await this.clients.findByAccountAndName(user.accountId, body.name)) {
      throw new ConflictException(`A client named "${body.name}" already exists`);
    }
    return this.clients.create({
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
      account: { connect: { id: user.accountId } },
    } as any);
  }

  async update(id: number, body: UpdateClientRequest, user: User): Promise<Client> {
    const client = await this.findOne(id, user); // enforces account ownership
    if (body.name && body.name !== client.name) {
      const clash = await this.clients.findByAccountAndName(client.accountId, body.name);
      if (clash && clash.id !== id) {
        throw new ConflictException(`A client named "${body.name}" already exists`);
      }
    }
    return this.clients.update(id, body);
  }

  async remove(id: number, user: User): Promise<Client> {
    const client = await this.findOne(id, user);
    const projectCount = await this.projects.count({ where: { clientId: id } });
    if (projectCount > 0) {
      throw new ConflictException(
        `Client has ${projectCount} project(s); reassign or delete them before removing the client`,
      );
    }
    return this.clients.delete(id);
  }
}
