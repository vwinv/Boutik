"use client";

import type { StorefrontProduct } from "@boutik/sdk";
import { formatPriceXof, productImage } from "../../lib/theme";
import { useCart } from "./cart-context";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const cart = useCart();
  const image = productImage(product.name, product.photos);
  const promo = Boolean(product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof);
  const rupture = product.availability === "OUT_OF_STOCK";

  return (
    <article className="product-lift group min-w-0">
      <div className="relative overflow-hidden rounded-[22px]" style={{ background: "var(--site-card)" }}>
        <img src={image} alt="" className="zoom-img aspect-[4/5] w-full object-cover" />
        {promo ? (
          <span
            className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
            style={{ background: "var(--site-primary)" }}
          >
            Promo
          </span>
        ) : null}
        {rupture ? (
          <span className="absolute top-3 right-3 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white">
            Rupture
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--site-muted)" }}>
        {product.category?.name || "Produits"}
      </p>
      <h3 className="mt-1 truncate text-sm font-semibold">{product.name}</h3>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--site-primary)" }}>
        {formatPriceXof(product.priceXof)}
      </p>
      {promo ? (
        <p className="text-xs line-through" style={{ color: "var(--site-muted)" }}>
          {formatPriceXof(product.compareAtPriceXof!)}
        </p>
      ) : null}
      <button
        type="button"
        disabled={rupture}
        onClick={() =>
          cart.addItem({
            slug: product.slug,
            name: product.name,
            priceXof: product.priceXof,
            image,
          })
        }
        className="soft mt-3 rounded-full px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        style={{ background: "var(--site-primary)" }}
      >
        {rupture ? "Indisponible" : "Ajouter au panier"}
      </button>
    </article>
  );
}
