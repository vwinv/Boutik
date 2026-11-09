-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletEntryReason" AS ENUM ('ORDER_SALE', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "reason" "WalletEntryReason" NOT NULL,
    "amountXof" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "orderId" TEXT,
    "withdrawalId" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountXof" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'MOBILE_MONEY',
    "destination" TEXT NOT NULL,
    "destinationName" TEXT,
    "requestedByUserId" TEXT,
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_orderId_reason_key" ON "WalletLedgerEntry"("orderId", "reason");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_tenantId_createdAt_idx" ON "WalletLedgerEntry"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_tenantId_availableAt_idx" ON "WalletLedgerEntry"("tenantId", "availableAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_withdrawalId_idx" ON "WalletLedgerEntry"("withdrawalId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_tenantId_status_idx" ON "WalletWithdrawal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_tenantId_createdAt_idx" ON "WalletWithdrawal"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WalletWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
