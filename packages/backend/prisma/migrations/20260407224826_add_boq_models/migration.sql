-- CreateEnum
CREATE TYPE "BOQStatus" AS ENUM ('PROCESSING', 'DRAFT', 'REVIEWED', 'APPROVED', 'EXPORTED');

-- CreateTable
CREATE TABLE "boqs" (
    "id" TEXT NOT NULL,
    "boqNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectName" TEXT,
    "clientName" TEXT,
    "status" "BOQStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdById" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSelling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin" DOUBLE PRECISION,
    "aiModel" TEXT,
    "drawingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_drawings" (
    "id" TEXT NOT NULL,
    "boqId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "aiNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boq_drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_items" (
    "id" TEXT NOT NULL,
    "boqId" TEXT NOT NULL,
    "sectionNumber" TEXT,
    "section" TEXT,
    "itemNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitSelling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSelling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceSource" TEXT,
    "priceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specs" TEXT,
    "drawingRef" TEXT,

    CONSTRAINT "boq_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boqs_boqNumber_key" ON "boqs"("boqNumber");

-- CreateIndex
CREATE INDEX "boqs_status_idx" ON "boqs"("status");

-- CreateIndex
CREATE INDEX "boqs_createdById_idx" ON "boqs"("createdById");

-- CreateIndex
CREATE INDEX "boq_items_boqId_idx" ON "boq_items"("boqId");

-- AddForeignKey
ALTER TABLE "boqs" ADD CONSTRAINT "boqs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_drawings" ADD CONSTRAINT "boq_drawings_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "boqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "boqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
