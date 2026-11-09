"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, formatXof, initialsFromName, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  ordersCount: number;
  totalSpentXof: number;
  lastOrderAt: string | null;
  registered: boolean;
};

export function ClientsPage() {
  return (
    <ProShell title="Clients">
      <ClientsBody />
    </ProShell>
  );
}

function ClientsBody() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe();
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      const list = await proApi<Customer[]>(`/api/workspaces/${active.tenantId}/customers`);
      setCustomers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      const phone = (customer.phone || "").toLowerCase();
      const email = (customer.email || "").toLowerCase();
      return (
        customer.name.toLowerCase().includes(q) ||
        phone.includes(q) ||
        phone.replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
        email.includes(q)
      );
    });
  }, [customers, query]);

  return (
    <div className="overflow-hidden rounded-[24px] bg-white">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm font-semibold tracking-tight">Clients de votre boutique</p>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Rechercher</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom ou téléphone…"
            className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pr-4 pl-9 text-sm outline-none focus:border-neutral-400"
          />
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-400">⌕</span>
        </label>
      </div>

      {error ? <p className="px-5 py-4 text-sm text-red-600 sm:px-6">{error}</p> : null}

      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">Chargement des clients…</p>
      ) : filtered.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">
          {customers.length === 0 ? "Aucun client pour le moment." : "Aucun client pour cette recherche."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-100 text-[11px] font-semibold tracking-[0.08em] text-neutral-400 uppercase">
              <tr>
                <th className="px-5 py-3.5 sm:px-6">Nom</th>
                <th className="px-5 py-3.5">Téléphone</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Commandes</th>
                <th className="px-5 py-3.5 sm:px-6">Total dépensé</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-b border-neutral-50 last:border-0">
                  <td className="px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
                        {initialsFromName(customer.name)}
                      </span>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-neutral-700">{customer.phone || "—"}</td>
                  <td className="px-5 py-4 text-neutral-700">{customer.email || "—"}</td>
                  <td className="px-5 py-4 font-medium">{customer.ordersCount}</td>
                  <td className="px-5 py-4 font-medium whitespace-nowrap sm:px-6">
                    {formatXof(customer.totalSpentXof)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
