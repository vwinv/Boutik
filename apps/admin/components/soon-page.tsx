"use client";

import { AdminShell } from "./admin-shell";

export function SoonPage({ title }: { title: string }) {
  return (
    <AdminShell title={title}>
      <div className="rounded-[24px] border border-dashed border-neutral-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-neutral-500">Cette section arrive bientôt.</p>
      </div>
    </AdminShell>
  );
}
