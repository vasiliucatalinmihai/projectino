import { ProjectType } from '@prisma/client';

export const PROJECT_TYPE_REQUIRES_TECH_DESIGN: Record<ProjectType, boolean> = {
  [ProjectType.WEB]: true,
  [ProjectType.MOBILE]: true,
  [ProjectType.CONSULTING_ERP]: false,
  [ProjectType.CONSULTING_BUSINESS_PROCESS]: false,
  [ProjectType.IOT]: true,
  [ProjectType.ERP_IMPLEMENTATION]: true,
  [ProjectType.FRONTEND_ONLY]: true,
  [ProjectType.OTHER]: true,
};

export function requiresTechDesign(projectType: ProjectType): boolean {
  return PROJECT_TYPE_REQUIRES_TECH_DESIGN[projectType] ?? true;
}

/** Display label for prompts — resolves the free-text label when type is OTHER. */
export function projectTypeLabel(project: { projectType: ProjectType; projectTypeOtherLabel?: string | null }): string {
  if (project.projectType === ProjectType.OTHER && project.projectTypeOtherLabel?.trim()) {
    return project.projectTypeOtherLabel.trim();
  }
  return PROJECT_TYPE_LABEL[project.projectType] ?? project.projectType;
}

export function resolveLanguage(project: { language?: string | null }): string {
  return project.language?.trim() || 'English';
}

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  [ProjectType.WEB]: 'Web',
  [ProjectType.MOBILE]: 'Mobile',
  [ProjectType.CONSULTING_ERP]: 'ERP consulting',
  [ProjectType.CONSULTING_BUSINESS_PROCESS]: 'Business process consulting',
  [ProjectType.IOT]: 'IoT',
  [ProjectType.ERP_IMPLEMENTATION]: 'ERP implementation',
  [ProjectType.FRONTEND_ONLY]: 'Frontend-only app',
  [ProjectType.OTHER]: 'Other',
};
