-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('IDENTITY', 'NINEA', 'RCCM', 'OTHER');

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'ARCHIVED';

-- CreateTable
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Professional_ownerUserId_idx" ON "Professional"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "professionalId" TEXT,
ADD COLUMN "legalName" TEXT,
ADD COLUMN "ninea" TEXT,
ADD COLUMN "rccm" TEXT,
ADD COLUMN "addressLine" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'SN',
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Dakar',
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'XOF',
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedReason" TEXT,
ADD COLUMN "statusBeforeSuspend" "TenantStatus",
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- One professional per owner user, then attach existing workspaces
INSERT INTO "Professional" ("id", "ownerUserId", "displayName", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, u.name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (
    SELECT 1 FROM "Membership" m WHERE m."userId" = u.id AND m.role = 'OWNER'
);

UPDATE "Tenant" AS t
SET "professionalId" = p.id
FROM "Membership" AS m
JOIN "Professional" AS p ON p."ownerUserId" = m."userId"
WHERE m."tenantId" = t.id AND m.role = 'OWNER';

DELETE FROM "Tenant" WHERE "professionalId" IS NULL;

ALTER TABLE "Tenant" ALTER COLUMN "professionalId" SET NOT NULL;

CREATE INDEX "Tenant_professionalId_idx" ON "Tenant"("professionalId");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TenantDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantDocument_tenantId_idx" ON "TenantDocument"("tenantId");

ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
