-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'COD');

-- CreateEnum
CREATE TYPE "OrderPaymentProvider" AS ENUM ('NONE', 'PAYDUNYA', 'COD');

-- AlterEnum
ALTER TYPE "OrderEventType" ADD VALUE 'PAYMENT';

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paymentProvider" "OrderPaymentProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "paydunyaToken" TEXT,
ADD COLUMN "paydunyaInvoiceUrl" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_paydunyaToken_idx" ON "Order"("paydunyaToken");

-- CreateIndex
CREATE INDEX "Order_tenantId_paymentStatus_idx" ON "Order"("tenantId", "paymentStatus");
