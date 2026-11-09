export function MaintenancePage({ title }: { title?: string | null }) {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 text-white">
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">Site en maintenance</p>
        {title ? <p className="mt-3 text-sm text-white/50">{title}</p> : null}
      </div>
    </main>
  );
}
