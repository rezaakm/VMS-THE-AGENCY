-- Client receivables (AR) for collection tracking

CREATE TABLE "client_receivables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientName" VARCHAR(255) NOT NULL,
    "reference" VARCHAR(100),
    "description" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_receivables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_receivables_status_idx" ON "client_receivables"("status");
CREATE INDEX "client_receivables_dueDate_idx" ON "client_receivables"("dueDate");
