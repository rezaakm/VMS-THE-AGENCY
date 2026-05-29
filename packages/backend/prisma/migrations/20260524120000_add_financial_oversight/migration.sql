-- Financial Oversight Module
-- Migration: Add financial flags, checklist, and process tracking

-- Enums
CREATE TYPE "FlagSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'OVERDUE');
CREATE TYPE "FlagCategory" AS ENUM ('BUDGET', 'REVENUE', 'COSTS', 'AR', 'STAFF', 'EXPENSES', 'RECONCILIATION', 'COMPLIANCE', 'PROCESSES');
CREATE TYPE "Acknowledgement" AS ENUM ('YES', 'NO', 'PARTIALLY');
CREATE TYPE "ResponseGrade" AS ENUM ('ADEQUATE', 'PARTIAL', 'INADEQUATE');
CREATE TYPE "ChecklistFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');
CREATE TYPE "CompletionStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'SKIPPED');
CREATE TYPE "ProcessStatus" AS ENUM ('NOT_STARTED', 'IN_DEVELOPMENT', 'ACTIVE', 'NEEDS_UPDATE');

-- Financial Flags (audit issues / investigation items)
CREATE TABLE "financial_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flagNumber" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "severity" "FlagSeverity" NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "category" "FlagCategory" NOT NULL,
    "assignedTo" VARCHAR(255),
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_flags_status_idx" ON "financial_flags"("status");
CREATE INDEX "financial_flags_severity_idx" ON "financial_flags"("severity");
CREATE INDEX "financial_flags_category_idx" ON "financial_flags"("category");

-- Flag Responses (A-F template submissions)
CREATE TABLE "flag_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flagId" UUID NOT NULL,
    "acknowledgement" "Acknowledgement",
    "rootCause" TEXT,
    "currentStatus" TEXT,
    "correctiveAction" TEXT,
    "evidence" JSONB DEFAULT '[]',
    "completionDate" DATE,
    "grade" "ResponseGrade",
    "reviewerNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "flag_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flag_responses_flagId_idx" ON "flag_responses"("flagId");
ALTER TABLE "flag_responses" ADD CONSTRAINT "flag_responses_flagId_fkey"
    FOREIGN KEY ("flagId") REFERENCES "financial_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Monthly Financial Checklist Items (templates)
CREATE TABLE "financial_checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "frequency" "ChecklistFrequency" NOT NULL,
    "owner" VARCHAR(255) NOT NULL,
    "dueDay" INTEGER,
    "category" "FlagCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_checklist_items_pkey" PRIMARY KEY ("id")
);

-- Checklist Completions (period tracking)
CREATE TABLE "checklist_completions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checklistItemId" UUID NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'PENDING',
    "completedBy" VARCHAR(255),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "evidence" TEXT,

    CONSTRAINT "checklist_completions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_completions_period_idx" ON "checklist_completions"("period");
CREATE UNIQUE INDEX "checklist_completions_item_period_unique" ON "checklist_completions"("checklistItemId", "period");
ALTER TABLE "checklist_completions" ADD CONSTRAINT "checklist_completions_checklistItemId_fkey"
    FOREIGN KEY ("checklistItemId") REFERENCES "financial_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Financial Process Registry (SOPs)
CREATE TABLE "financial_processes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "owner" VARCHAR(255) NOT NULL,
    "frequency" "ChecklistFrequency" NOT NULL,
    "status" "ProcessStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "templateUrl" TEXT,
    "lastExecuted" TIMESTAMP(3),
    "nextDue" TIMESTAMP(3),
    "trainingRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_processes_pkey" PRIMARY KEY ("id")
);
