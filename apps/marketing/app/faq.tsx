"use client";

import { useState } from "react";
import { Reveal } from "./reveal";

const questions = [
  {
    q: "Faut-il des connaissances techniques ?",
    a: "Non. Vous choisissez un modèle, remplissez vos informations et ajoutez vos produits ou services depuis l'espace pro. Tout se fait sans code.",
  },
  {
    q: "Comment mes clients paient-ils ?",
    a: "Par Mobile Money (Wave, Orange Money, MTN) directement sur votre site. Le montant est crédité sur votre wallet Boutik.",
  },
  {
    q: "Comment je récupère mon argent ?",
    a: "Depuis votre wallet, vous demandez un retrait vers votre compte Mobile Money. L'équipe Boutik le valide puis effectue le versement.",
  },
  {
    q: "Puis-je utiliser mon propre nom de domaine ?",
    a: "Oui, à partir de l'offre Pro. Avec l'offre Découverte, votre site est accessible sur votre-nom.boutik.app.",
  },
  {
    q: "Puis-je changer d'offre ou de modèle plus tard ?",
    a: "Oui, à tout moment. Vos contenus, produits et commandes sont conservés.",
  },
  {
    q: "Qui peut m'aider en cas de problème ?",
    a: "Le support Boutik répond depuis votre espace pro. Les abonnés Business bénéficient du support prioritaire.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-[#f6f6f7] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">Questions fréquentes</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {questions.map((item, index) => {
            const expanded = open === index;
            return (
              <Reveal key={item.q} as="article" delay={index * 60} className="rounded-[22px] bg-white px-5 sm:px-6">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-[15px] font-medium"
                >
                  <span>{item.q}</span>
                  <span className="text-xl leading-none text-neutral-500" aria-hidden="true">
                    {expanded ? "−" : "+"}
                  </span>
                </button>
                <div
                  aria-hidden={!expanded}
                  className="grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }}
                >
                  <div className="overflow-hidden">
                    <p className="pr-8 pb-5 text-sm leading-relaxed text-neutral-500">{item.a}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
