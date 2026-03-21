-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_vendorId_fkey";

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
