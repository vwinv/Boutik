import { publicOrigin } from "@boutik/domain";

export default function SiteNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-moss">Boutik</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl">
        Ce site n&apos;existe pas
      </h1>
      <a href={publicOrigin()} className="mt-8 text-clay">
        Retour à Boutik
      </a>
    </main>
  );
}
