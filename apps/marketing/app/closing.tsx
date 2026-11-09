import { Reveal } from "./reveal";

const product = [
  { href: "#types", label: "Types de sites" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#modeles", label: "Modèles" },
  { href: "#tarifs", label: "Tarifs" },
];

const help = [
  { href: "#faq", label: "FAQ" },
  { href: "#faq", label: "Support" },
  { href: "#faq", label: "Conditions d'utilisation" },
];

export function Closing() {
  return (
    <>
      <section className="bg-white px-5 pt-6 pb-4 sm:px-8">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-neutral-950 px-6 py-16 text-center text-white sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -right-40 size-64 -translate-y-1/2 rounded-full sm:-right-24 sm:size-80 lg:size-[340px]"
            style={{
              background: "repeating-linear-gradient(-28deg, #2c2c2c 0 11px, #111 11px 22px)",
            }}
          />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              Lancez votre site
              <br />
              Boutik aujourd&apos;hui.
            </h2>
            <p className="mt-4 text-base text-white/70">L&apos;offre Découverte est gratuite, sans limite de durée.</p>
            <a href="/onboarding" className="soft mt-8 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-950">
              Créer mon site
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-neutral-200/70 bg-white px-5 pt-14 pb-10">
        <Reveal className="mx-auto flex max-w-6xl flex-col gap-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <a href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <span className="grid size-8 place-items-center rounded-[9px] bg-neutral-950 text-sm text-white">B</span>
              Boutik
            </a>
            <p className="mt-4 text-sm leading-relaxed text-neutral-500">
              Sites professionnels pour boutiques, restaurants et entreprises.
            </p>
          </div>
          <div className="flex gap-16 sm:gap-24">
            <nav>
              <p className="text-sm font-semibold">Produit</p>
              <ul className="mt-4 space-y-2.5 text-sm text-neutral-500">
                {product.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="hover:text-neutral-950">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav>
              <p className="text-sm font-semibold">Aide</p>
              <ul className="mt-4 space-y-2.5 text-sm text-neutral-500">
                {help.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="hover:text-neutral-950">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </Reveal>
        <p className="mx-auto mt-16 max-w-6xl text-sm text-neutral-400">© 2026 Boutik</p>
      </footer>
    </>
  );
}
