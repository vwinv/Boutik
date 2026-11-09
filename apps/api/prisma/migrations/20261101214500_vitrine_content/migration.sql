-- AlterEnum
ALTER TYPE "SiteSectionType" ADD VALUE 'BANNER';
ALTER TYPE "SiteSectionType" ADD VALUE 'HOURS';

-- CreateEnum
CREATE TYPE "SiteAssetKind" AS ENUM ('LOGO', 'COVER', 'FAVICON', 'BANNER', 'SECTION');

-- AlterTable
ALTER TABLE "TenantSite" ADD COLUMN "bannerUrl" TEXT;

-- CreateTable
CREATE TABLE "SiteOpeningHour" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteOpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAsset" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sectionId" TEXT,
    "kind" "SiteAssetKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "alt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteOpeningHour_siteId_weekday_key" ON "SiteOpeningHour"("siteId", "weekday");
CREATE INDEX "SiteAsset_siteId_kind_idx" ON "SiteAsset"("siteId", "kind");

ALTER TABLE "SiteOpeningHour" ADD CONSTRAINT "SiteOpeningHour_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "TenantSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteAsset" ADD CONSTRAINT "SiteAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "TenantSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
