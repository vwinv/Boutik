-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SiteSectionType" AS ENUM ('HERO', 'TEXT', 'IMAGE', 'GALLERY', 'CONTACT', 'CTA');

-- CreateTable
CREATE TABLE "TenantSite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3D5A40',
    "secondaryColor" TEXT NOT NULL DEFAULT '#C45C26',
    "backgroundColor" TEXT NOT NULL DEFAULT '#F4EFE6',
    "textColor" TEXT NOT NULL DEFAULT '#1C1917',
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "faviconUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "youtubeUrl" TEXT,
    "linkedinUrl" TEXT,
    "xUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "ogImageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" "SiteSectionType" NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSite_tenantId_key" ON "TenantSite"("tenantId");

CREATE UNIQUE INDEX "SitePage_siteId_slug_key" ON "SitePage"("siteId", "slug");

CREATE INDEX "SitePage_siteId_sortOrder_idx" ON "SitePage"("siteId", "sortOrder");

CREATE INDEX "SiteSection_pageId_sortOrder_idx" ON "SiteSection"("pageId", "sortOrder");

ALTER TABLE "TenantSite" ADD CONSTRAINT "TenantSite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "TenantSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteSection" ADD CONSTRAINT "SiteSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
