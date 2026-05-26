import { PrismaClient, ProjectStage } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Keep in sync with src/common/permission-key.ts (kept inline so the seed has
// no dependency on the app source tree).
const PERMISSIONS = [
  { key: 'ADMIN', description: 'Full access to everything' },
  { key: 'VIEW_ONLY', description: 'Read-only access' },
  { key: 'RUN_LLM', description: 'Can run AI/LLM features' },
  { key: 'UPDATE_SETTINGS', description: 'Can change application settings' },
  { key: 'MANAGE_PROMPTS', description: 'Can edit and promote prompt versions' },
];

const SETTINGS = [
  { key: 'company_name', value: 'Productino Software', description: 'Display name of the company' },
  { key: 'default_currency', value: 'EUR', description: 'Currency used in proposals & estimates' },
  { key: 'llm_model', value: 'claude-opus-4-7', description: 'Default model for AI features' },
  { key: 'estimation_buffer_pct', value: '20', description: 'Buffer added to estimates, in percent' },
  { key: 'support_email', value: 'hello@productino.io', description: 'Public support email address' },
];

const PROJECTS = [
  { name: 'Acme mobile app', clientName: 'Acme Inc.', stage: ProjectStage.BRIEFING, briefing: 'iOS + Android app for field technicians to log site visits.' },
  { name: 'Globex CRM revamp', clientName: 'Globex', stage: ProjectStage.GAP_ANALYSIS, briefing: 'Replace the legacy CRM with a web app; migrate 12k accounts.' },
  { name: 'Initech client portal', clientName: 'Initech', stage: ProjectStage.DEFINITION, briefing: 'Self-service portal for invoices, tickets and document sharing.' },
  { name: 'Umbrella analytics dashboard', clientName: 'Umbrella Corp', stage: ProjectStage.PLANNING, briefing: 'Real-time KPI dashboards sourced from their data warehouse.' },
  { name: 'Wayne logistics tracker', clientName: 'Wayne Enterprises', stage: ProjectStage.DELIVERY, briefing: 'Fleet + parcel tracking with live maps and ETA estimates.' },
];

async function main() {
  // Permissions (idempotent).
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
  }

  // Settings (idempotent by key).
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { description: s.description },
      create: s,
    });
  }

  // Default admin user.
  await prisma.user.upsert({
    where: { email: 'admin@productino.local' },
    update: {},
    create: {
      email: 'admin@productino.local',
      name: 'Admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      permissions: { connect: [{ key: 'ADMIN' }] },
    },
  });

  // A read-only user for testing the guard.
  await prisma.user.upsert({
    where: { email: 'viewer@productino.local' },
    update: {},
    create: {
      email: 'viewer@productino.local',
      name: 'Viewer',
      passwordHash: await bcrypt.hash('viewer123', 10),
      permissions: { connect: [{ key: 'VIEW_ONLY' }] },
    },
  });

  // Dummy projects — only when the table is empty, so re-seeding won't duplicate.
  if ((await prisma.project.count()) === 0) {
    await prisma.project.createMany({ data: PROJECTS });
  }

  // eslint-disable-next-line no-console
  console.log('Seeded permissions, settings, users and projects');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
