"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { initialsFromName } from "../lib/format";
import { AdminShell } from "./admin-shell";

type StaffRoleKey = "OWNER" | "ADMIN" | "SUPPORT" | "FINANCE" | "MODERATION";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRoleKey;
  roleLabel: string;
  status: "ACTIVE" | "DISABLED" | "INVITED";
  statusLabel: string;
  twoFaEnabled: boolean;
  lastLoginAt: string | null;
  invitedAt: string | null;
};

type TeamPayload = {
  kpis: {
    activeCount: number;
    totalCount: number;
    twoFaCount: number;
    invitedCount: number;
  };
  roles: Array<{ key: StaffRoleKey; label: string; memberCount: number; modules: string[] }>;
  items: TeamMember[];
};

const ROLE_OPTIONS: Array<{ value: StaffRoleKey; label: string }> = [
  { value: "OWNER", label: "Super admin" },
  { value: "SUPPORT", label: "Support" },
  { value: "FINANCE", label: "Finance" },
  { value: "MODERATION", label: "Modération" },
];

export function UsersPage() {
  return (
    <AdminShell title="Utilisateurs">
      <UsersBody />
    </AdminShell>
  );
}

function UsersBody() {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [team, user] = await Promise.all([
        staffApi<TeamPayload>("/api/admin/users"),
        fetchStaffMe(),
      ]);
      setData(team);
      setMe(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l’équipe.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.roleLabel.toLowerCase().includes(q),
    );
  }, [data, query]);

  async function run(action: () => Promise<TeamPayload>) {
    setBusy(true);
    setError(null);
    try {
      setData(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="text-sm text-neutral-500">Chargement des membres…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const canManage = me?.staffRole === "OWNER" || me?.staffRole === "ADMIN";

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="relative w-full sm:max-w-xs">
          <span className="sr-only">Rechercher</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        {canManage ? (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Inviter un membre
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          dark
          label="Membres actifs"
          value={String(data.kpis.activeCount)}
          sub={`sur ${data.kpis.totalCount} compte${data.kpis.totalCount > 1 ? "s" : ""}`}
        />
        <Kpi
          label="Double authentification"
          value={`${data.kpis.twoFaCount}/${data.kpis.totalCount}`}
          sub="membres protégés"
        />
        <Kpi
          label="Invitations en attente"
          value={String(data.kpis.invitedCount)}
          sub="expirent après 72 h"
        />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-neutral-50 text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
            <tr>
              <th className="px-5 py-3 font-semibold">Membre</th>
              <th className="px-5 py-3 font-semibold">Rôle</th>
              <th className="px-5 py-3 font-semibold">Double auth.</th>
              <th className="px-5 py-3 font-semibold">Dernière connexion</th>
              <th className="px-5 py-3 font-semibold">Statut</th>
              <th className="px-5 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-neutral-400">
                  Aucun membre ne correspond à cette recherche.
                </td>
              </tr>
            ) : (
              filtered.map((member) => {
                const isSelf = me?.id === member.id;
                return (
                  <tr key={member.id} className="border-t border-neutral-100">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-neutral-950 text-[11px] font-semibold text-white">
                          {initialsFromName(member.name)}
                        </span>
                        <div>
                          <p className="font-semibold tracking-tight">{member.name}</p>
                          <p className="text-xs text-neutral-400">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {canManage && !isSelf ? (
                        <select
                          value={member.role}
                          disabled={busy}
                          onChange={(event) =>
                            void run(() =>
                              staffApi<TeamPayload>(`/api/admin/users/${member.id}/staff-role`, {
                                method: "PATCH",
                                body: JSON.stringify({ staffRole: event.target.value }),
                              }),
                            )
                          }
                          className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm outline-none"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium">{member.roleLabel}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={member.twoFaEnabled ? "green" : "orange"}>
                        {member.twoFaEnabled ? "Activée" : "Désactivée"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-neutral-500">
                      {member.status === "INVITED" ? "—" : relativeTime(member.lastLoginAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          member.status === "ACTIVE" ? "green" : member.status === "INVITED" ? "orange" : "gray"
                        }
                      >
                        {member.statusLabel}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      {isSelf ? (
                        <span className="text-neutral-400">Vous</span>
                      ) : !canManage ? (
                        <span className="text-neutral-300">—</span>
                      ) : member.status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`Désactiver ${member.name} ?`)) return;
                            void run(() =>
                              staffApi<TeamPayload>(`/api/admin/users/${member.id}/deactivate`, {
                                method: "POST",
                              }),
                            );
                          }}
                          className="text-sm font-semibold text-[#b42323]"
                        >
                          Désactiver
                        </button>
                      ) : member.status === "DISABLED" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              staffApi<TeamPayload>(`/api/admin/users/${member.id}/reactivate`, {
                                method: "POST",
                              }),
                            )
                          }
                          className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold"
                        >
                          Réactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              staffApi<TeamPayload>(`/api/admin/users/${member.id}/resend-invite`, {
                                method: "POST",
                              }),
                            )
                          }
                          className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold"
                        >
                          Renvoyer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Rôles et accès</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Chaque rôle ouvre une partie de l’administration. Changez le rôle d’un membre directement dans le
          tableau.
        </p>
        <div className="mt-6 space-y-5">
          {data.roles.map((role) => (
            <div key={role.key}>
              <div className="flex items-center gap-2">
                <p className="font-semibold tracking-tight">{role.label}</p>
                <span className="text-xs text-neutral-400">
                  {role.memberCount} membre{role.memberCount > 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {role.modules.map((module) => (
                  <span
                    key={module}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600"
                  >
                    {module}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {inviteOpen ? (
        <InviteModal
          busy={busy}
          onClose={() => setInviteOpen(false)}
          onSubmit={(values) =>
            void run(async () => {
              const payload = await staffApi<TeamPayload>("/api/admin/users", {
                method: "POST",
                body: JSON.stringify(values),
              });
              setInviteOpen(false);
              return payload;
            })
          }
        />
      ) : null}
    </div>
  );
}

function InviteModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; email: string; staffRole: StaffRoleKey }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRoleKey>("SUPPORT");
  const valid = name.trim().length >= 2 && email.includes("@");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), staffRole });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">Inviter un membre</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Le lien d’invitation expire après 72 h. La double authentification est demandée à la première
          connexion.
        </p>
        <label className="mt-5 block">
          <span className="text-sm text-neutral-500">Nom complet *</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Email *</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom@boutik.app"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Rôle</span>
          <select
            value={staffRole}
            onChange={(event) => setStaffRole(event.target.value as StaffRoleKey)}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || !valid}
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Envoyer l’invitation"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
}) {
  return (
    <article
      className={`rounded-[22px] px-4 py-4 ${
        dark ? "bg-[#1d1d1f] text-white" : "border border-neutral-200 bg-white text-neutral-950"
      }`}
    >
      <p className={`text-sm ${dark ? "text-white/55" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs ${dark ? "text-white/45" : "text-neutral-400"}`}>{sub}</p>
    </article>
  );
}

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: "green" | "orange" | "gray";
}) {
  const className =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "orange"
        ? "bg-amber-100 text-amber-800"
        : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
