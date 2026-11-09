import type { Metadata } from "next";
import { CONTRACT_SECTIONS, CONTRACT_VERSION } from "../contract-text";
import { PrintContract } from "./print-contract";

export const metadata: Metadata = {
  title: "Contrat de service — Boutik",
  description: "Contrat de service Boutik à lire avant la signature électronique.",
};

export default function ContractPage() {
  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-10 text-neutral-950 print:bg-white print:px-0 print:py-0">
      <article className="mx-auto max-w-3xl rounded-[28px] bg-white px-6 py-10 sm:px-12 print:max-w-none print:rounded-none">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-semibold tracking-tight">Boutik</p>
          <PrintContract />
        </div>
        <h1 className="mt-8 text-4xl leading-none font-semibold tracking-tight">Contrat de service</h1>
        <p className="mt-4 text-sm text-neutral-500">
          Version du 2 novembre 2026 · {CONTRACT_VERSION}. Document à lire avant la signature électronique.
        </p>
        <div className="mt-10 space-y-8">
          {CONTRACT_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold">{section.heading}</h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-neutral-700">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
