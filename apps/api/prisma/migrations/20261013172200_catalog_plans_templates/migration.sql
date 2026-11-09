-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "SiteCategory" (
    "code" "Category" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteCategory_pkey" PRIMARY KEY ("code")
);

INSERT INTO "SiteCategory" ("code", "label", "description", "isActive", "sortOrder") VALUES
('VITRINE', 'Site vitrine', 'Présentez votre activité, vos réalisations et vos coordonnées.', true, 1),
('RESTAURANT', 'Restaurant', 'Menu, horaires, réservations et commande à emporter.', true, 2),
('BOUTIQUE', 'E-commerce', 'Catalogue, panier, paiement et suivi des commandes.', true, 3);

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_category_fkey" FOREIGN KEY ("category") REFERENCES "SiteCategory"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SiteSubcategory" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSubcategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteSubcategory_category_slug_key" ON "SiteSubcategory"("category", "slug");

ALTER TABLE "SiteSubcategory" ADD CONSTRAINT "SiteSubcategory_category_fkey" FOREIGN KEY ("category") REFERENCES "SiteCategory"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "includesPremiumTemplates" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capabilities" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");
CREATE INDEX "Plan_category_isActive_idx" ON "Plan"("category", "isActive");

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_category_fkey" FOREIGN KEY ("category") REFERENCES "SiteCategory"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "amountXof" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanPrice_planId_interval_key" ON "PlanPrice"("planId", "interval");

ALTER TABLE "PlanPrice" ADD CONSTRAINT "PlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlanOption" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountXof" INTEGER NOT NULL,
    "capability" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanOption_planId_slug_key" ON "PlanOption"("planId", "slug");

ALTER TABLE "PlanOption" ADD CONSTRAINT "PlanOption_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SiteTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "previewUrl" TEXT,
    "thumbnailUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteTemplate_slug_key" ON "SiteTemplate"("slug");

-- CreateTable
CREATE TABLE "TemplateCategory" (
    "templateId" TEXT NOT NULL,
    "category" "Category" NOT NULL,

    CONSTRAINT "TemplateCategory_pkey" PRIMARY KEY ("templateId","category")
);

ALTER TABLE "TemplateCategory" ADD CONSTRAINT "TemplateCategory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SiteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Tenant offering
ALTER TABLE "Tenant" ADD COLUMN "subcategoryId" TEXT,
ADD COLUMN "planId" TEXT,
ADD COLUMN "planInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN "templateId" TEXT;

CREATE INDEX "Tenant_planId_idx" ON "Tenant"("planId");
CREATE INDEX "Tenant_templateId_idx" ON "Tenant"("templateId");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "SiteSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SiteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TenantPlanOption" (
    "tenantId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "TenantPlanOption_pkey" PRIMARY KEY ("tenantId","optionId")
);

ALTER TABLE "TenantPlanOption" ADD CONSTRAINT "TenantPlanOption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantPlanOption" ADD CONSTRAINT "TenantPlanOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PlanOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
