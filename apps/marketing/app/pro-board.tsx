import { Reveal } from "./reveal";

const orders = [
  { label: "CMD-3381 · Kente & Co", status: "Expédiée", tone: "bg-[#e7edff] text-[#3b5bdb]" },
  { label: "CMD-3380 · Robe wax Adjoa", status: "Préparation", tone: "bg-[#fff0e0] text-[#d97706]" },
  { label: "Table 4 pers. · 20:00", status: "Confirmée", tone: "bg-[#e5f6ea] text-[#1f9d55]" },
];

const sections = [
  { label: "Bannière d'accueil", on: true },
  { label: "Nos produits", on: true },
  { label: "Galerie photo", on: true },
  { label: "Avis clients", on: false },
];

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-6 w-11 shrink-0 rounded-full ${on ? "bg-neutral-950" : "bg-neutral-200"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm ${on ? "right-0.5" : "left-0.5"}`} />
    </span>
  );
}

export function ProBoard() {
  return (
    <section className="bg-white px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-sm text-neutral-500">Espace pro</p>
          <h2 className="mt-3 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Gérez votre activité depuis un seul tableau de bord.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-500">
            Commandes, réservations, catalogue, contenu du site et argent encaissé : tout est au même endroit, sur
            ordinateur comme sur téléphone.
          </p>
        </Reveal>

        <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3">
          <Reveal as="article" delay={0} className="lift flex flex-col rounded-[28px] bg-[#f3f3f4] p-6">
            <h3 className="text-[15px] font-semibold">Commandes et réservations</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Suivez chaque commande de « Nouvelle » à « Livrée », confirmez les réservations et les rendez-vous.
            </p>
            <ul className="mt-6 space-y-2.5 lg:mt-auto lg:pt-6">
              {orders.map((order) => (
                <li
                  key={order.label}
                  className="flex items-center justify-between gap-3 rounded-full bg-white px-4 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <span className="truncate font-medium">{order.label}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${order.tone}`}>{order.status}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal as="article" delay={90} className="lift flex flex-col rounded-[28px] bg-[#f3f3f4] p-6">
            <h3 className="text-[15px] font-semibold">Wallet et retraits</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Vos ventes sont créditées sur votre wallet Boutik. Demandez un retrait vers Wave, Orange Money ou MTN
              quand vous le souhaitez.
            </p>
            <div className="mt-6 rounded-[22px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:mt-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-neutral-400">Disponible</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">2 310 000 FCFA</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400">En attente</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">185 000</p>
                </div>
              </div>
              <span className="mt-4 block rounded-full bg-neutral-950 py-2.5 text-center text-sm font-medium text-white">
                Demander un retrait
              </span>
            </div>
          </Reveal>

          <Reveal as="article" delay={180} className="lift flex flex-col rounded-[28px] bg-[#f3f3f4] p-6">
            <h3 className="text-[15px] font-semibold">Votre site, à votre image</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Modifiez les sections, les photos, le logo et les couleurs. Prévisualisez sur mobile, puis publiez en un
              clic.
            </p>
            <ul className="mt-6 space-y-2.5 lg:mt-auto lg:pt-6">
              {sections.map((section) => (
                <li
                  key={section.label}
                  className="flex items-center justify-between gap-3 rounded-full bg-white px-4 py-2 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <span className="font-medium">{section.label}</span>
                  <Toggle on={section.on} />
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
