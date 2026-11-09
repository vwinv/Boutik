import { Closing } from "./closing";
import { Faq } from "./faq";
import { Pricing } from "./pricing";
import { ProBoard } from "./pro-board";
import { Reveal } from "./reveal";
import { Templates } from "./templates";
import { ShowcaseSlider } from "./showcase-slider";
import { SiteTypes } from "./site-types";

const steps = [
  {
    n: "01",
    title: "Créez votre compte",
    text: "Email, téléphone et mot de passe, vérifiés par un code à 6 chiffres.",
  },
  {
    n: "02",
    title: "Choisissez votre activité",
    text: "Boutique, restaurant ou site vitrine.",
  },
  {
    n: "03",
    title: "Présentez-vous",
    text: "Nom, adresse, horaires, réseaux et logo.",
  },
  {
    n: "04",
    title: "Signez le contrat",
    text: "Lecture et signature électronique du contrat Boutik.",
  },
  {
    n: "05",
    title: "Personnalisez",
    text: "Choix du modèle et de vos couleurs.",
  },
  {
    n: "06",
    title: "Publiez",
    text: "Ajoutez vos produits ou services et mettez votre site en ligne.",
  },
];

const features: { title: string; items: { label: string; badge?: string }[] }[] = [
  {
    title: "Vente",
    items: [
      { label: "Catalogue produits / menu" },
      { label: "Gestion des commandes" },
      { label: "Paiement Mobile Money" },
      { label: "Codes promo" },
      { label: "Zones et frais de livraison" },
      { label: "Facturation automatique", badge: "BÊTA" },
    ],
  },
  {
    title: "Modules",
    items: [
      { label: "Gestion de stock" },
      { label: "Réservations de table" },
      { label: "Prise de rendez-vous" },
    ],
  },
  {
    title: "Site",
    items: [
      { label: "Nom de domaine personnalisé" },
      { label: "Modèles premium" },
      { label: "Retirer la mention Boutik" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Référencement (SEO)" },
      { label: "Statistiques avancées" },
      { label: "Bouton WhatsApp" },
      { label: "Avis clients", badge: "BÊTA" },
      { label: "Programme de fidélité", badge: "BIENTÔT" },
    ],
  },
  {
    title: "Compte",
    items: [
      { label: "Comptes collaborateurs" },
      { label: "Support prioritaire" },
      { label: "Wallet et retraits Mobile Money" },
    ],
  },
];

const nav = [
  { href: "#types", label: "Types de sites" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "/connexion", label: "Espace pro" },
  { href: "#modeles", label: "Modèles" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-8 px-5">
          <a href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-[9px] bg-neutral-950 text-sm text-white">B</span>
            Boutik
          </a>
          <nav className="hidden items-center gap-6 text-sm whitespace-nowrap text-neutral-800 xl:flex">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors duration-300 hover:text-neutral-950">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href="/connexion" className="soft text-sm font-medium whitespace-nowrap text-neutral-900">
              Se connecter
            </a>
            <a href="/onboarding" className="soft rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium whitespace-nowrap text-white">
              Créer mon site
            </a>
          </div>
        </div>
      </header>

      <section className="px-5 pt-14 text-center sm:pt-20">
        <p className="rise inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <span className="size-2 rounded-full bg-emerald-500" />
          Paiement Mobile Money intégré · Wave, Orange Money, MTN
        </p>
        <h1
          className="rise mx-auto mt-8 max-w-4xl text-[40px] leading-[1.08] font-semibold tracking-tight sm:text-6xl lg:text-[68px]"
          style={{ animationDelay: "90ms" }}
        >
          Votre site professionnel, en ligne en quelques minutes.
        </h1>
        <p
          className="rise mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-500 sm:text-lg"
          style={{ animationDelay: "180ms" }}
        >
          Boutique, restaurant ou site vitrine : Boutik vous donne un site à votre image, les paiements, les commandes
          et un wallet pour encaisser vos ventes.
        </p>
        <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "280ms" }}>
          <a href="/onboarding" className="soft rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white">
            Créer mon site gratuitement
          </a>
          <a
            href="#exemples"
            className="soft rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            Voir des exemples
          </a>
        </div>
        <p className="rise mt-4 text-sm text-neutral-400" style={{ animationDelay: "380ms" }}>
          Sans carte bancaire · 14 jours d&apos;essai sur les offres Pro et Business
        </p>
      </section>

      <section id="exemples" className="overflow-hidden bg-white px-5 pb-16 sm:pb-24">
        <ShowcaseSlider />
      </section>

      <SiteTypes />

      <section className="bg-white px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm text-neutral-500">Comment ça marche</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              De l&apos;inscription à la publication, en six étapes.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {steps.map((step, index) => (
              <Reveal
                as="li"
                key={step.n}
                delay={index * 70}
                className="lift min-h-[188px] rounded-[22px] border border-neutral-200 bg-white p-5"
              >
                <p className="text-xs font-medium text-neutral-400">{step.n}</p>
                <h3 className="mt-8 text-[15px] leading-snug font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="fonctionnalites" className="bg-[#141414] px-5 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm text-white/55">Fonctionnalités</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              Tout ce qu&apos;il faut pour vendre et être trouvé.
            </h2>
          </Reveal>
          <ul className="mt-10 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {features.map((group, index) => (
              <Reveal as="li" key={group.title} delay={index * 70} className="lift rounded-[22px] bg-[#262626] p-5">
                <h3 className="text-[15px] font-semibold">{group.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm leading-snug text-white/55">
                  {group.items.map((item) => (
                    <li key={item.label} className="flex items-start justify-between gap-3">
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span className="mt-0.5 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/80">
                          {item.badge}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <ProBoard />

      <Templates />

      <Pricing />

      <Faq />

      <Closing />
    </main>
  );
}
