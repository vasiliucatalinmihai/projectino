import { PrismaClient, ProjectStage, SourceKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Keep in sync with src/common/permission-key.ts.
const PERMISSIONS = [
  { key: 'SUPER_ADMIN', description: 'Platform owner — access across all accounts' },
  { key: 'ADMIN', description: 'Full access within own account' },
  { key: 'VIEW_ONLY', description: 'Read-only access' },
  { key: 'RUN_LLM', description: 'Can run AI/LLM features' },
  { key: 'UPDATE_SETTINGS', description: 'Can change application settings' },
  { key: 'MANAGE_PROMPTS', description: 'Can edit and promote prompt versions' },
  { key: 'RESET_PROJECT', description: "Can reset a project's analysis (cascading)" },
];

const SETTINGS = [
  { key: 'company_name', value: 'Acme Agency', description: 'Display name of the company' },
  { key: 'default_currency', value: 'EUR', description: 'Currency used in proposals & estimates' },
  { key: 'day_rate', value: '600', description: 'Blended day rate used to price proposals' },
  { key: 'llm_model', value: 'claude-opus-4-7', description: 'Default model for AI features' },
  { key: 'estimation_buffer_pct', value: '20', description: 'Buffer added to estimates, in percent' },
];

const CLIENTS = [
  { name: 'Acme Inc.', email: 'ops@acme.example', phone: '+40 700 000 001', address: '1 Innovation Way, Cluj-Napoca' },
  { name: 'Globex', email: 'it@globex.example', phone: '+40 700 000 002', address: '42 Industrial Rd, Bucharest' },
  { name: 'Initech', email: 'pm@initech.example', phone: '+40 700 000 003', address: '8 Office Park, Timișoara' },
  { name: 'Umbrella Corp', email: 'data@umbrella.example', phone: '+40 700 000 004', address: '5 Raccoon Blvd, Iași' },
  { name: 'Wayne Enterprises', email: 'logistics@wayne.example', phone: '+40 700 000 005', address: '1 Wayne Tower, Brașov' },
];

const PROJECTS = [
  { name: 'Acme mobile app', client: 'Acme Inc.', stage: ProjectStage.BRIEFING, briefing: 'iOS + Android app for field technicians to log site visits.' },
  { name: 'Globex CRM revamp', client: 'Globex', stage: ProjectStage.GAP_ANALYSIS, briefing: 'Replace the legacy CRM with a web app; migrate 12k accounts.' },
  { name: 'Initech client portal', client: 'Initech', stage: ProjectStage.DEFINITION, briefing: 'Self-service portal for invoices, tickets and document sharing.' },
  { name: 'Umbrella analytics dashboard', client: 'Umbrella Corp', stage: ProjectStage.PLANNING, briefing: 'Real-time KPI dashboards sourced from their data warehouse.' },
  { name: 'Wayne logistics tracker', client: 'Wayne Enterprises', stage: ProjectStage.DELIVERY, briefing: 'Fleet + parcel tracking with live maps and ETA estimates.' },
];

async function main() {
  // Permissions (idempotent).
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: { description: p.description }, create: p });
  }

  // Accounts: the platform-owner "system" account and a demo tenant.
  const system = await prisma.account.upsert({
    where: { slug: 'system' },
    update: {},
    create: { name: 'Productino', slug: 'system', isSystem: true },
  });
  const acme = await prisma.account.upsert({
    where: { slug: 'acme' },
    update: { bringYourOwnAi: true },
    create: { name: 'Acme Agency', slug: 'acme', bringYourOwnAi: true },
  });

  // Super admin lives in the system account.
  await prisma.user.upsert({
    where: { email: 'super@productino.local' },
    update: { active: true },
    create: {
      email: 'super@productino.local',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash('super123', 10),
      active: true,
      account: { connect: { id: system.id } },
      permissions: { connect: [{ key: 'SUPER_ADMIN' }] },
    },
  });

  // A second super admin in the platform (system) account.
  await prisma.user.upsert({
    where: { email: 'admin@productino.local' },
    update: {
      active: true,
      account: { connect: { id: system.id } },
      permissions: { set: [{ key: 'SUPER_ADMIN' }] },
    },
    create: {
      email: 'admin@productino.local',
      name: 'Platform Admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      active: true,
      account: { connect: { id: system.id } },
      permissions: { connect: [{ key: 'SUPER_ADMIN' }] },
    },
  });
  await prisma.user.upsert({
    where: { email: 'viewer@productino.local' },
    update: { active: true },
    create: {
      email: 'viewer@productino.local',
      name: 'Acme Viewer',
      passwordHash: await bcrypt.hash('viewer123', 10),
      active: true,
      account: { connect: { id: acme.id } },
      permissions: { connect: [{ key: 'VIEW_ONLY' }] },
    },
  });

  // Settings for the Acme account.
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { accountId_key: { accountId: acme.id, key: s.key } },
      update: { description: s.description },
      create: { ...s, account: { connect: { id: acme.id } } },
    });
  }

  // Platform-wide AI model catalog (provider → selectable models) on the system
  // account. Super admins edit it via Settings to add/refresh models without a
  // deploy. Keep in sync with src/common/ai-catalog.ts.
  const MODEL_CATALOG = {
    anthropic: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
  };
  await prisma.setting.upsert({
    where: { accountId_key: { accountId: system.id, key: 'AI_MODEL_CATALOG' } },
    update: {}, // don't clobber runtime edits on re-seed
    create: {
      key: 'AI_MODEL_CATALOG',
      value: JSON.stringify(MODEL_CATALOG, null, 2),
      description: 'AI model catalog (provider → selectable models) for the admin dropdowns',
      account: { connect: { id: system.id } },
    },
  });

  // Clients for Acme (idempotent on accountId+name).
  for (const c of CLIENTS) {
    await prisma.client.upsert({
      where: { accountId_name: { accountId: acme.id, name: c.name } },
      update: { email: c.email, phone: c.phone, address: c.address },
      create: { ...c, account: { connect: { id: acme.id } } },
    });
  }

  // The platform default model, on the system account. Accounts that are NOT
  // "bring your own AI" run on this one. Same shape as any tenant model.
  if ((await prisma.aiModel.count({ where: { accountId: system.id } })) === 0) {
    await prisma.aiModel.create({
      data: {
        accountId: system.id,
        label: 'Platform default',
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        apiKey: 'sk-ant-demo-PLACEHOLDER-0000',
        isActive: true,
      },
    });
  }

  // A demo AI model for Acme (it's a "bring your own AI" account).
  if ((await prisma.aiModel.count({ where: { accountId: acme.id } })) === 0) {
    await prisma.aiModel.create({
      data: {
        accountId: acme.id,
        label: 'Acme Claude',
        provider: 'anthropic',
        model: 'claude-opus-4-7',
        apiKey: 'sk-ant-demo-PLACEHOLDER-0000',
        isActive: true,
      },
    });
  }

  // Dummy projects for Acme — only when empty, so re-seeding won't duplicate.
  // Each project's briefing becomes its first Belief Graph source (round 1).
  if ((await prisma.project.count({ where: { accountId: acme.id } })) === 0) {
    const clients = await prisma.client.findMany({ where: { accountId: acme.id } });
    const clientIdByName = new Map(clients.map((c) => [c.name, c.id]));
    for (const p of PROJECTS) {
      const project = await prisma.project.create({
        data: {
          name: p.name,
          stage: p.stage,
          accountId: acme.id,
          clientId: clientIdByName.get(p.client)!,
        },
      });
      if (p.briefing) {
        await prisma.source.create({
          data: {
            projectId: project.id,
            kind: SourceKind.BRIEFING,
            content: p.briefing,
            round: 1,
          },
        });
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seeded accounts, permissions, settings, users and projects');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
