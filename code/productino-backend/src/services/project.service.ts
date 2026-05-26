import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../repository';
import { Project } from '../entities';
import { CreateProjectRequest, UpdateProjectRequest } from '../http/request/project';

@Injectable()
export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  findAll(): Promise<Project[]> {
    return this.projects.findAll();
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projects.findById(id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(body: CreateProjectRequest): Promise<Project> {
    return this.projects.create(body);
  }

  async update(id: number, body: UpdateProjectRequest): Promise<Project> {
    await this.findOne(id);
    return this.projects.update(id, body);
  }

  async remove(id: number): Promise<Project> {
    await this.findOne(id);
    return this.projects.delete(id);
  }
}
