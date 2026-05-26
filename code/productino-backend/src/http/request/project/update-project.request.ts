import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProjectStage } from '@prisma/client';
import { CreateProjectRequest } from './create-project.request';

export class UpdateProjectRequest extends PartialType(CreateProjectRequest) {
  @IsOptional()
  @IsEnum(ProjectStage)
  stage?: ProjectStage;
}
