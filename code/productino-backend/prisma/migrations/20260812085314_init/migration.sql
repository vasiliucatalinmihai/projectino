-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('BRIEFING', 'GAP_ANALYSIS', 'AWAITING_CLIENT', 'DEFINITION', 'TECH_DESIGN', 'PLANNING', 'PROPOSAL');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('WEB', 'MOBILE', 'CONSULTING_ERP', 'CONSULTING_BUSINESS_PROCESS', 'IOT', 'ERP_IMPLEMENTATION', 'FRONTEND_ONLY', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineRole" AS ENUM ('BUSINESS_ANALYST', 'TECH_LEAD');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('BRIEFING', 'TRANSCRIPT', 'EMAIL', 'ANSWERS');

-- CreateEnum
CREATE TYPE "BeliefNodeType" AS ENUM ('REQUIREMENT', 'ASSUMPTION', 'RISK', 'DECISION');

-- CreateEnum
CREATE TYPE "BeliefStatus" AS ENUM ('STATED', 'INFERRED', 'ASSUMED', 'CONFIRMED', 'REJECTED', 'CONTRADICTED');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('UNDERDEFINED', 'THIN', 'ADEQUATE', 'SOLID');

-- CreateEnum
CREATE TYPE "QuestionImpact" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('OPEN', 'INCLUDED', 'EXCLUDED', 'ANSWERED');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DeliveryLevel" AS ENUM ('EPIC', 'STORY', 'TASK');

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "bringYourOwnAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "label" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activationToken" TEXT,
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "ProjectStage" NOT NULL DEFAULT 'BRIEFING',
    "projectType" "ProjectType" NOT NULL DEFAULT 'WEB',
    "projectTypeOtherLabel" TEXT,
    "language" TEXT,
    "rubric" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "kind" "SourceKind" NOT NULL DEFAULT 'BRIEFING',
    "label" TEXT,
    "content" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "belief_nodes" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "nodeType" "BeliefNodeType" NOT NULL DEFAULT 'REQUIREMENT',
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "BeliefStatus" NOT NULL DEFAULT 'INFERRED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coverageKey" TEXT,
    "provenance" JSONB NOT NULL DEFAULT '[]',
    "round" INTEGER NOT NULL DEFAULT 1,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "belief_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_areas" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" TEXT NOT NULL DEFAULT 'medium',
    "owner" "PipelineRole" NOT NULL DEFAULT 'BUSINESS_ANALYST',
    "rollupConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CoverageStatus" NOT NULL DEFAULT 'UNDERDEFINED',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverage_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "coverageKey" TEXT,
    "text" TEXT NOT NULL,
    "assumedAnswer" TEXT,
    "askedBy" "PipelineRole" NOT NULL DEFAULT 'BUSINESS_ANALYST',
    "impact" "QuestionImpact" NOT NULL DEFAULT 'MEDIUM',
    "status" "QuestionStatus" NOT NULL DEFAULT 'OPEN',
    "answerText" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_rounds" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "rollupConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflicts" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "beliefA" TEXT NOT NULL,
    "beliefB" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "currency" TEXT NOT NULL,
    "dayRate" INTEGER NOT NULL,
    "totalLowCost" INTEGER NOT NULL DEFAULT 0,
    "totalHighCost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_items" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "level" "DeliveryLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimateLow" INTEGER,
    "estimateHigh" INTEGER,
    "phase" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_definitions" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "confidenceAtGeneration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gateOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_designs" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "confidenceAtGeneration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tech_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "activeVersionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" SERIAL NOT NULL,
    "promptId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "checksum" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'file',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_experiments" (
    "id" SERIAL NOT NULL,
    "promptId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "variants" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_runs" (
    "id" SERIAL NOT NULL,
    "promptKey" TEXT NOT NULL,
    "versionId" INTEGER NOT NULL,
    "experimentId" INTEGER,
    "subjectType" TEXT,
    "subjectId" INTEGER,
    "success" BOOLEAN,
    "latencyMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "provider" TEXT,
    "model" TEXT,
    "score" DOUBLE PRECISION,
    "validationRounds" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserPermissions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_slug_key" ON "accounts"("slug");

-- CreateIndex
CREATE INDEX "ai_models_accountId_idx" ON "ai_models"("accountId");

-- CreateIndex
CREATE INDEX "clients_accountId_idx" ON "clients"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_accountId_name_key" ON "clients"("accountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_activationToken_key" ON "users"("activationToken");

-- CreateIndex
CREATE INDEX "users_accountId_idx" ON "users"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_accountId_key_key" ON "settings"("accountId", "key");

-- CreateIndex
CREATE INDEX "projects_accountId_idx" ON "projects"("accountId");

-- CreateIndex
CREATE INDEX "projects_clientId_idx" ON "projects"("clientId");

-- CreateIndex
CREATE INDEX "sources_projectId_idx" ON "sources"("projectId");

-- CreateIndex
CREATE INDEX "belief_nodes_projectId_idx" ON "belief_nodes"("projectId");

-- CreateIndex
CREATE INDEX "belief_nodes_coverageKey_idx" ON "belief_nodes"("coverageKey");

-- CreateIndex
CREATE INDEX "coverage_areas_projectId_idx" ON "coverage_areas"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_areas_projectId_key_key" ON "coverage_areas"("projectId", "key");

-- CreateIndex
CREATE INDEX "questions_projectId_idx" ON "questions"("projectId");

-- CreateIndex
CREATE INDEX "project_rounds_projectId_idx" ON "project_rounds"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_rounds_projectId_index_key" ON "project_rounds"("projectId", "index");

-- CreateIndex
CREATE INDEX "conflicts_projectId_idx" ON "conflicts"("projectId");

-- CreateIndex
CREATE INDEX "proposals_projectId_idx" ON "proposals"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_projectId_version_key" ON "proposals"("projectId", "version");

-- CreateIndex
CREATE INDEX "delivery_items_projectId_idx" ON "delivery_items"("projectId");

-- CreateIndex
CREATE INDEX "delivery_items_parentId_idx" ON "delivery_items"("parentId");

-- CreateIndex
CREATE INDEX "product_definitions_projectId_idx" ON "product_definitions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "product_definitions_projectId_version_key" ON "product_definitions"("projectId", "version");

-- CreateIndex
CREATE INDEX "tech_designs_projectId_idx" ON "tech_designs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "tech_designs_projectId_version_key" ON "tech_designs"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "prompts_key_key" ON "prompts"("key");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_promptId_version_key" ON "prompt_versions"("promptId", "version");

-- CreateIndex
CREATE INDEX "prompt_runs_promptKey_idx" ON "prompt_runs"("promptKey");

-- CreateIndex
CREATE UNIQUE INDEX "_UserPermissions_AB_unique" ON "_UserPermissions"("A", "B");

-- CreateIndex
CREATE INDEX "_UserPermissions_B_index" ON "_UserPermissions"("B");

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "belief_nodes" ADD CONSTRAINT "belief_nodes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_areas" ADD CONSTRAINT "coverage_areas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_rounds" ADD CONSTRAINT "project_rounds_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "delivery_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_definitions" ADD CONSTRAINT "product_definitions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_designs" ADD CONSTRAINT "tech_designs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_experiments" ADD CONSTRAINT "prompt_experiments_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPermissions" ADD CONSTRAINT "_UserPermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPermissions" ADD CONSTRAINT "_UserPermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

