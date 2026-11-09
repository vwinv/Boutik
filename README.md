# Boutik

Plateforme SaaS multi-espaces : landing, administration Boutik, espace professionnel, sites publics.

La plateforme reste sur le domaine Boutik. Chaque professionnel a son propre sous-domaine.

| Adresse | Produit |
| --- | --- |
| `www.boutik.com` | Landing Boutik |
| `www.boutik.com/admin` | Administration Boutik |
| `www.boutik.com/app` | Espace professionnel |
| `marie.boutik.com` | Site public du professionnel |
| `www.boutik.com/api` | API NestJS |

En local : `http://localhost:3000` pour Boutik, `http://marie.localhost:3000` pour un site marchand. L’ancien chemin `/site/marie` redirige vers le sous-domaine.

## Stack

Next.js · NestJS · PostgreSQL · Prisma · pnpm + Turborepo

## Environnements

| | Développement | Test | Production |
| --- | --- | --- | --- |
| Fichier | `.env.development` | `.env.test` | variables d’hôte + `.env.production.example` |
| Commande | `pnpm dev` | `pnpm test` | `pnpm build` puis `pnpm start` |
| Base | `boutik` | `boutik_test` | `DATABASE_URL` |
| Logs | `debug` | `error` | `info` |
| Migrations | `pnpm db:migrate` | `pnpm db:migrate:test` | `pnpm db:migrate:deploy` |

Overrides personnels : `.env.local` (non commité). Ne jamais committer `.env.production`.

## Démarrer

Postgres local requis (utilisateur système `mac`).

```bash
createdb boutik
createdb boutik_test
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:migrate:test
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Comptes de seed (mot de passe `changeme`) :

- `admin@boutik.local` — staff Boutik
- `marie@marie.local` — boutique Chez Marie
- `claire@table.local` — restaurant
- `lea@atelier.local` — vitrine
