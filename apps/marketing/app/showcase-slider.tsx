"use client";

import { useEffect, useRef } from "react";

const slides = [
  {
    id: "awa",
    kind: "site" as const,
    name: "Maison Awa",
    host: "maison-awa.boutik.app",
    badge: "Boutique",
    image: "/landing/maison-awa.jpg",
    alt: "Intérieur de la boutique Maison Awa",
  },
  {
    id: "baobab",
    kind: "wallet" as const,
  },
  {
    id: "kora",
    kind: "site" as const,
    name: "Studio Kora",
    host: "studio-kora.boutik.app",
    badge: "Site vitrine",
    image: "/landing/studio-kora.jpg",
    alt: "L'équipe de Studio Kora au travail",
  },
];

const bars = [42, 58, 50, 74, 64, 86, 56, 94, 70, 82, 66, 100];
const CENTER = 1;
const SIDE = 0.68;
const MOVE_MS = 1700;
const PAUSE_MS = 1900;

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function ShowcaseSlider() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    const onMotion = () => {
      reduced = motion.matches;
    };
    motion.addEventListener("change", onMotion);

    let progress = 1;
    let from = 1;
    let to = 1;
    let phase: "pause" | "move" = "pause";
    let pauseUntil = performance.now() + PAUSE_MS;
    let moveStart = 0;
    let frame = 0;

    const place = (now: number) => {
      const width = root.clientWidth;
      const cardWidth = Math.min(360, Math.max(240, width * 0.34));
      const cardHeight = cardWidth * 1.32;
      const spacing = cardWidth * ((CENTER + SIDE) / 2) + (width < 800 ? 28 : 40);

      if (!reduced) {
        if (phase === "pause" && now >= pauseUntil) {
          phase = "move";
          from = progress;
          to = progress + 1;
          moveStart = now;
        }
        if (phase === "move") {
          const t = Math.min(1, (now - moveStart) / MOVE_MS);
          progress = from + (to - from) * smoothstep(t);
          if (t >= 1) {
            progress = to;
            phase = "pause";
            pauseUntil = now + PAUSE_MS;
          }
        }
      }

      const cursor = progress % slides.length;
      slides.forEach((_, index) => {
        const card = cardsRef.current[index];
        if (!card) return;
        let distance = index - cursor;
        if (distance > 1.5) distance -= slides.length;
        if (distance < -1.5) distance += slides.length;
        const abs = Math.abs(distance);
        const scale = CENTER - (CENTER - SIDE) * Math.min(abs, 1);
        const opacity = abs <= 1 ? 1 : Math.max(0, 1 - (abs - 1) / 0.32);
        card.style.width = `${cardWidth}px`;
        card.style.height = `${cardHeight}px`;
        card.style.transform = `translate(-50%, -50%) translateX(${distance * spacing}px) scale(${scale})`;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(20 - Math.round(abs * 10));
      });

      frame = requestAnimationFrame(place);
    };

    frame = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative mx-auto mt-14 h-[460px] max-w-6xl sm:h-[540px] lg:h-[620px]" aria-roledescription="carousel">
      <p className="sr-only">Exemples de sites Boutik, en rotation</p>
      {slides.map((slide, index) => (
        <article
          key={slide.id}
          ref={(node) => {
            cardsRef.current[index] = node;
          }}
          aria-hidden={index !== 1}
          className="absolute top-1/2 left-1/2 w-[240px] opacity-0"
        >
          {slide.kind === "wallet" ? <WalletCard /> : <SiteCard slide={slide} />}
        </article>
      ))}
    </div>
  );
}

function SiteCard({ slide }: { slide: (typeof slides)[number] & { kind: "site" } }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(17,17,17,0.12)]">
      <div className="relative min-h-0 flex-1">
        <img src={slide.image} alt={slide.alt} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-950">{slide.name}</p>
          <p className="truncate text-xs text-neutral-500">{slide.host}</p>
        </div>
        <span className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600">{slide.badge}</span>
      </div>
    </div>
  );
}

function WalletCard() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-neutral-950 px-5 py-5 text-white shadow-[0_24px_60px_rgba(17,17,17,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-white/65">Wallet · Le Baobab</p>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs">Restaurant</span>
      </div>
      <p className="mt-auto pt-6 text-sm text-white/55">Solde disponible</p>
      <p className="mt-2 text-[34px] leading-none font-semibold tracking-tight whitespace-nowrap">
        1 640 000 <span className="text-[18px] font-medium text-white/80">FCFA</span>
      </p>
      <div className="mt-5 flex h-20 items-end gap-1.5" aria-hidden>
        {bars.map((height, index) => (
          <span
            key={index}
            className={`flex-1 rounded-[3px] ${index === bars.length - 1 ? "bg-white" : "bg-white/25"}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="truncate">Thiéboudiene × 2 · Wave</span>
          <span className="shrink-0 text-emerald-300">+9 000 FCFA</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="truncate">Réservation · 4 pers.</span>
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs">Confirmée</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="truncate">Yassa poulet · Orange Money</span>
          <span className="shrink-0 text-emerald-300">+4 000 FCFA</span>
        </li>
      </ul>
    </div>
  );
}
