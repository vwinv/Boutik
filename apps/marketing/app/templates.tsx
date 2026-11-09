import { Reveal } from "./reveal";

const templates = [
  {
    name: "Éclat",
    text: "Grand bandeau coloré, mise en avant forte",
    plan: "Gratuit",
    header: "bg-neutral-950",
    bar: "bg-white/85",
    images: ["/landing/robe-wax.jpg", "/landing/sac-raphia.jpg", "/landing/eclat-feuilles.jpg"],
  },
  {
    name: "Minimal",
    text: "Blanc, centré, très typographique",
    plan: "Gratuit",
    header: "bg-white",
    bar: "bg-neutral-950",
    images: ["/landing/minimal-palette.jpg", "/landing/minimal-tablette.jpg", "/landing/minimal-archi.jpg"],
  },
  {
    name: "Atelier",
    text: "Tons crème et grande photo",
    plan: "Premium",
    header: "bg-[#f4efe6]",
    bar: "bg-neutral-800",
    images: ["/landing/baobab-plat.jpg", "/landing/baobab-hero.jpg", "/landing/atelier-dessert.jpg"],
  },
  {
    name: "Nocturne",
    text: "Fond sombre, élégant",
    plan: "Premium",
    header: "bg-neutral-950",
    bar: "bg-white/80",
    images: ["/landing/nocturne-plat.jpg", "/landing/nocturne-salle.jpg", "/landing/nocturne-grill.jpg"],
  },
];

export function Templates() {
  return (
    <section id="modeles" className="bg-[#f6f6f7] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-sm text-neutral-500">Modèles</p>
          <h2 className="mt-3 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Choisissez un modèle, ajoutez vos couleurs.
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template, index) => (
            <Reveal
              as="li"
              key={template.name}
              delay={index * 80}
              className="group lift rounded-[28px] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
            >
              <div className="overflow-hidden rounded-[20px] border border-neutral-200/80">
                <div className={`flex h-16 items-start px-4 pt-4 ${template.header}`}>
                  <span className={`h-1.5 w-14 rounded-full ${template.bar}`} />
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-white p-2">
                  {template.images.map((src) => (
                    <img key={src} src={src} alt="" className="zoom-img aspect-square w-full rounded-lg object-cover" />
                  ))}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3 px-2 pt-4 pb-3">
                <div>
                  <p className="text-[15px] font-semibold">{template.name}</p>
                  <p className="mt-1 text-sm leading-snug text-neutral-500">{template.text}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    template.plan === "Premium" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {template.plan}
                </span>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
