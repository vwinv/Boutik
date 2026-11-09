-- Support N options par variante (au-delà de Couleur × Taille)
ALTER TABLE "ProductVariant" ADD COLUMN "options" JSONB;
