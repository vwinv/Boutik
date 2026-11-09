-- Photos liées à une option (souvent Couleur / SKC)
ALTER TABLE "ProductPhoto" ADD COLUMN "optionKind" TEXT;
ALTER TABLE "ProductPhoto" ADD COLUMN "optionValue" TEXT;

CREATE INDEX "ProductPhoto_productId_optionKind_optionValue_idx"
  ON "ProductPhoto"("productId", "optionKind", "optionValue");
