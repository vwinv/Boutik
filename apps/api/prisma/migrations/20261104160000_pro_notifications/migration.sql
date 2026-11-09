-- CreateEnum
CREATE TYPE "ProNotificationKind" AS ENUM ('ORDERS', 'PAYMENTS', 'WITHDRAWALS', 'SUBSCRIPTION', 'PUBLICATION', 'SECURITY', 'SUPPORT');

-- CreateTable
CREATE TABLE "ProNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "ProNotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProNotification_tenantId_createdAt_idx" ON "ProNotification"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ProNotification_tenantId_readAt_idx" ON "ProNotification"("tenantId", "readAt");

-- CreateIndex
CREATE INDEX "ProNotification_tenantId_archivedAt_idx" ON "ProNotification"("tenantId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProNotification_tenantId_dedupeKey_key" ON "ProNotification"("tenantId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "ProNotification" ADD CONSTRAINT "ProNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
