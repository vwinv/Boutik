"use client";

import { useState } from "react";
import { Reveal } from "./reveal";

type PreviewItem = {
  image: string;
  name: string;
  price: string;
};

type SiteKind = {
  id: string;
  label: string;
  title: string;
  description: string;
  features: string[];
  example: string;
  cover: string;
  coverTitle: string;
  coverText: string;
  items: PreviewItem[];
};

const sites: SiteKind[] = [
  {
    id: "boutique",
    label: "Boutique",
    title: "Boutique",
    description: "Présentez et vendez vos produits en ligne, avec panier, paiement et suivi des commandes.",
    features: [
      "Catalogue et fiches produits avec variantes",
      "Panier et paiement Mobile Money",
      "Gestion du stock et alertes de rupture",
      "Codes promo, zones et frais de livraison",
      "Suivi des commandes et fichier clients",
    ],
    example: "Maison Awa · maison-awa.boutik.app",
    cover: "/landing/boutique-hero.jpg",
    coverTitle: "Maison Awa",
    coverText: "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.",
    items: [
      { image: "/landing/robe-wax.jpg", name: "Robe wax Adjoa", price: "28 000 FCFA" },
      { image: "/landing/sac-raphia.jpg", name: "Sac en raphia", price: "15 000 FCFA" },
      { image: "/landing/beurre-karite.jpg", name: "Beurre de karité 250 g", price: "4 500 FCFA" },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    title: "Restaurant",
    description: "Publiez la carte, prenez les réservations et préparez les commandes à emporter.",
    features: [
      "Carte et menu du jour",
      "Réservations en ligne",
      "Click & collect",
      "Horaires d'ouverture",
      "Wallet et fichier clients",
    ],
    example: "Le Baobab · le-baobab.boutik.app",
    cover: "/landing/baobab-hero.jpg",
    coverTitle: "Le Baobab",
    coverText: "Cuisine du Sénégal, à table ou à emporter.",
    items: [
      { image: "/landing/baobab-plat.jpg", name: "Thiéboudienne", price: "4 500 FCFA" },
      { image: "/landing/baobab-bissap.jpg", name: "Bissap", price: "1 000 FCFA" },
      { image: "/landing/baobab-alloco.jpg", name: "Alloco", price: "1 500 FCFA" },
    ],
  },
  {
    id: "vitrine",
    label: "Site vitrine",
    title: "Site vitrine",
    description: "Présentez votre activité, vos réalisations et vos coordonnées. Vos clients vous trouvent et vous écrivent.",
    features: [
      "Pages à votre image",
      "Galerie de réalisations",
      "Horaires et coordonnées",
      "Formulaire de contact",
      "Référencement inclus",
    ],
    example: "Studio Kora · studio-kora.boutik.app",
    cover: "/landing/studio-kora.jpg",
    coverTitle: "Studio Kora",
    coverText: "Identité, photo et sites pour les marques d'ici.",
    items: [
      { image: "/landing/kora-identite.jpg", name: "Identité", price: "Logo et couleurs" },
      { image: "/landing/kora-photo.jpg", name: "Réalisations", price: "Galerie" },
      { image: "/landing/kora-site.jpg", name: "Contact", price: "Écrire au studio" },
    ],
  },
];

function Check() {
  return (
    <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-neutral-950 text-white">
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
        <path
          d="M2.2 6.2 4.7 8.7 9.8 3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function SiteTypes() {
  const [currentId, setCurrentId] = useState(sites[0].id);
  const current = sites.find((site) => site.id === currentId) ?? sites[0];

  return (
    <section id="types" className="bg-[#f6f6f7] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-sm text-neutral-500">Trois types de sites</p>
          <h2 className="mt-3 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Un site pensé pour votre activité.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-500">
            Chaque type de site arrive avec ses pages et ses modules. Vous pourrez en ajouter plus tard.
          </p>
        </Reveal>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Types de sites">
          {sites.map((site) => {
            const selected = site.id === current.id;
            return (
              <button
                key={site.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCurrentId(site.id)}
                className={`soft rounded-full px-4 py-2 text-sm font-medium ${
                  selected
                    ? "bg-neutral-950 text-white"
                    : "border border-neutral-200 bg-white text-neutral-900"
                }`}
              >
                {site.label}
              </button>
            );
          })}
        </div>

        <div
          key={current.id}
          className="panel-swap mt-8 grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-8"
        >
          <article className="relative z-10 flex flex-col rounded-[28px] border border-neutral-200 bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.04)] lg:p-8">
            <h3 className="text-[28px] font-semibold tracking-tight">{current.title}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-500">{current.description}</p>
            <ul className="mt-6 space-y-3">
              {current.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-[15px]">
                  <Check />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-end justify-between gap-4 border-t border-neutral-200 pt-5 lg:mt-auto">
              <div className="min-w-0">
                <p className="text-xs text-neutral-400">Exemple</p>
                <p className="mt-1 truncate text-sm font-semibold">{current.example}</p>
              </div>
              <a
                href="/onboarding"
                className="shrink-0 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
              >
                Créer ce site
              </a>
            </div>
          </article>

          <div className="group overflow-hidden rounded-[28px] border border-neutral-200 bg-white">
            <div className="relative h-52 sm:h-64">
              <img src={current.cover} alt="" className="zoom-img size-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pt-16 pb-4 text-white">
                <p className="text-xl font-semibold tracking-tight">{current.coverTitle}</p>
                <p className="mt-0.5 text-sm text-white/85">{current.coverText}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4 sm:gap-4 sm:p-5">
              {current.items.map((item) => (
                <figure key={item.name}>
                  <img src={item.image} alt="" className="zoom-img aspect-[3/4] w-full rounded-2xl object-cover" />
                  <figcaption className="mt-2.5">
                    <span className="block text-[13px] leading-snug text-neutral-900 sm:text-sm">{item.name}</span>
                    <span className="mt-0.5 block text-[13px] text-neutral-500">{item.price}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
