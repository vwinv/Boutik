-- CreateTable
CREATE TABLE "PlatformModule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categories" "Category"[],
    "amountXof" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantModule" (
    "tenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("tenantId","moduleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformModule_slug_key" ON "PlatformModule"("slug");

-- CreateIndex
CREATE INDEX "TenantModule_moduleId_idx" ON "TenantModule"("moduleId");

-- AddForeignKey
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "PlatformModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
