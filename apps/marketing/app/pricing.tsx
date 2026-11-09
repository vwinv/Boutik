"use client";

import { useState } from "react";
import { Reveal } from "./reveal";

const plans = [
  {
    name: "Découverte",
    monthly: 0,
    highlight: false,
    detail: "20 produits ou plats · 1 utilisateur · 5 % de commission",
    features: [
      "Site sur votre-nom.boutik.app",
      "Modèles gratuits",
      "Commandes et paiement Mobile Money",
      "Bouton WhatsApp",
      "Wallet et retraits",
    ],
    cta: "Commencer gratuitement",
  },
  {
    name: "Pro",
    monthly: 9900,
    highlight: true,
    badge: "Le plus choisi",
    detail: "200 produits ou plats · 3 utilisateurs · 2,5 % de commission",
    features: [
      "Nom de domaine personnalisé",
      "Modèles premium",
      "Codes promo et livraison",
      "Gestion de stock et réservations",
      "Référencement (SEO) et avis clients",
    ],
    cta: "Essayer 14 jours",
  },
  {
    name: "Business",
    monthly: 24900,
    highlight: false,
    detail: "Produits illimités · 10 utilisateurs · 1,5 % de commission",
    features: [
      "Tout l'offre Pro",
      "Prise de rendez-vous",
      "Facturation automatique",
      "Statistiques avancées",
      "Sans mention Boutik",
      "Support prioritaire",
    ],
    cta: "Essayer 14 jours",
  },
];

function formatXof(amount: number) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
      <path
        d="M3.2 8.2 6.3 11.4 12.8 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="tarifs" className="bg-white px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <p className="text-sm text-neutral-500">Tarifs</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              Commencez gratuitement, évoluez quand vous voulez.
            </h2>
          </Reveal>
          <div className="inline-flex w-fit rounded-full bg-neutral-100 p-1" role="tablist" aria-label="Période de facturation">
            <button
              type="button"
              role="tab"
              aria-selected={!yearly}
              onClick={() => setYearly(false)}
              className={`soft rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                yearly ? "text-neutral-500" : "bg-white text-neutral-950 shadow-sm"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={yearly}
              onClick={() => setYearly(true)}
              className={`soft rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                yearly ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
              }`}
            >
              Annuel - 2 mois offerts
            </button>
          </div>
        </div>

        <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const amount = yearly ? plan.monthly * 10 : plan.monthly;
            const dark = plan.highlight;
            return (
              <Reveal
                as="article"
                key={plan.name}
                delay={index * 90}
                className={`lift flex flex-col rounded-[28px] p-7 ${
                  dark ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                  {plan.badge ? (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-950">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <p key={yearly ? "an" : "mois"} className="panel-swap mt-6 flex items-end gap-2">
                  <span className="text-5xl leading-none font-semibold tracking-tight">
                    {amount === 0 ? "Gratuit" : formatXof(amount)}
                  </span>
                  {amount > 0 ? (
                    <span className={`mb-1 text-sm ${dark ? "text-white/70" : "text-neutral-500"}`}>
                      FCFA / {yearly ? "an" : "mois"}
                    </span>
                  ) : null}
                </p>
                <p className={`mt-3 text-sm leading-relaxed ${dark ? "text-white/70" : "text-neutral-500"}`}>{plan.detail}</p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/onboarding"
                  className={`soft mt-8 block rounded-full py-3 text-center text-sm font-medium ${
                    dark ? "bg-white text-neutral-950" : "bg-neutral-950 text-white"
                  }`}
                >
                  {plan.cta}
                </a>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-6 text-sm text-neutral-400">
          Prix en FCFA. La commission s&apos;applique uniquement aux ventes payées en ligne. Modèles premium : 15 000
          FCFA, une seule fois.
        </p>
      </div>
    </section>
  );
}
