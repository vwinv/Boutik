import { googleMapsDirectionsUrl } from "../../lib/maps";

export function BoutiqueFooter({
  mark,
  address,
  phone,
  email,
}: {
  mark: string;
  address: string;
  phone: string;
  email: string;
}) {
  const mapsHref = googleMapsDirectionsUrl(address);

  return (
    <footer className="px-4 py-8 sm:px-6" style={{ background: "var(--site-secondary)", color: "#fff" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-lg font-semibold">{mark}</p>
          {address ? <p className="mt-2 text-sm text-white/70">{address}</p> : null}
          <p className="mt-1 text-sm text-white/70">
            {[phone, "Lun – Sam · 9 h – 19 h"].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-3 text-xs text-white/50">
            © {new Date().getFullYear()} {mark}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <a href={`tel:${phone.replace(/\s+/g, "")}`} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90">
              Appeler
            </a>
          ) : null}
          {phone ? (
            <a href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90">
              WhatsApp
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90">
              Email
            </a>
          ) : null}
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90"
            >
              Itinéraire
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
