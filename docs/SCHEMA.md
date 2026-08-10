# Schéma de base de données — DelegPharma SaaS

Défini dans `backend/src/schema.js` (DDL unique adapté pour SQLite dev / PostgreSQL prod).
Le schéma est créé **automatiquement au boot** (`initSchema()`, tables `IF NOT EXISTS` +
migrations idempotentes) — aucune migration manuelle à la mise en service.

## Légende

- `*` = clé étrangère ; `(TEXT JSON)` = colonne JSON sérialisé en texte.
- Multi-tenant : chaque table métier porte `laboratoire_id` (isolation par laboratoire).
- Multi-pays : `pays → region → district` (hiérarchie sanitaire officielle du Sénégal, seedée).

## Référentiel (seedé : Sénégal 14 régions / 79 districts)

| Table | Colonnes | Notes |
|---|---|---|
| `meta` | `key` (unique), `value` | Idempotence du seed : `seeded_v1`, `formules_v1`, `users_ext_v1` |
| `pays` | `id`, `code` (unique), `nom` | Seed : `SN / Sénégal` |
| `region` | `id`, `pays_id*`, `nom` | 14 régions médicales |
| `district` | `id`, `region_id*`, `nom` | 79 districts sanitaires |
| `type_structure` | `id`, `nom` | Hôpital / Centre de santé / Poste / Case |
| `specialite` | `id`, `nom` | Médecine générale, Pharmacie, Pédiatrie… |
| `laboratoire` | `id`, `nom`, `agrement_arp`, `created_at` | **Tenant** (donneur d'ordre). Seed : MEDIS + 6 autres |
| `structure` | `id`, `laboratoire_id*`, `type_structure_id*`, `region_id*`, `district_id*`, `localite`, `telephone`, `geo`, `created_at` | Établissement visité |
| `professionnel` | `id`, `laboratoire_id*`, `nom`, `structure_id*`, `specialite_id*`, `potentiel` (`A/B/C`), `telephone`, `created_at` | Professionnel de santé (PS) |
| `produit` | `id`, `laboratoire_id*`, `nom`, `dci`, `presentation`, `agrement_arp`, `agrement_agence`, `created_at` | Produit phare |

## Utilisateurs & rôles

| Table | Colonnes | Notes |
|---|---|---|
| `users` | `id`, `laboratoire_id*` (nullable), `role`, `nom`, `email` (unique), `telephone`, `password_hash`, `professionnel_id*` (nullable), `created_at` | Rôles : `admin`, `laboratoire`, `manager`, `delegue`, `professionnel`, `plateforme`. Le CHECK d'origine a été retiré (migration idempotente) ; la validation du rôle est faite en code. `plateforme` = admin SaaS **sans tenant** (`laboratoire_id NULL`) |

## CRV & activités terrain

| Table | Colonnes | Notes |
|---|---|---|
| `visite` | `id`, `laboratoire_id*`, `user_id*` (délégué), `professionnel_id*`, `structure_id*`, `date`, `produits` (TEXT JSON `[{produit_id,qty}]`), `resultat` (`accord/reserve/refus/absent/''`), `compte_rendu`, `prochaine_visite`, `geo`, `statut` (`brouillon/soumis/valide/refuse`), `motif_refus`, `docs` (TEXT JSON `[{nom,type,data}]`, base64), `created_at` | **CRV** — le cœur métier. Export CSV via `/api/export/visites.csv` |
| `campagne` | `id`, `laboratoire_id*`, `nom`, `produit_id*`, `agrement_arp`, `debut`, `fin`, `objectif`, `statut` (`active/terminee/brouillon`), `region_id*`, `district_id*`, `created_at` | Campagne produit (objectif global) |
| `tournee` | `id`, `laboratoire_id*`, `user_id*`, `date`, `district_id*`, `ps_list` (TEXT JSON `[professionnel_id,…]`), `statut` (`planifiee/faite/annulee`), `created_at` | Tournée planifiée du délégué |

## Monétisation (§3 — module abonnement)

| Table | Colonnes | Notes |
|---|---|---|
| `formule` | `id`, `nom` (unique), `prix`, `duree_jours` (30), `fonctionnalites` (TEXT JSON), `created_at` | Essentiel 5 000 / Standard 10 000 / Premium 15 000 FCFA — seedé (`meta.formules_v1`) |
| `abonnement` | `id`, `user_id*`, `formule_id*`, `montant`, `date_debut`, `date_expiration`, `statut` (`en_attente/actif/arrive_expiration/expire/resilie`), `renouvellement_auto`, `ref_transaction`, `created_at` | Cycle de vie 30 j ; échéance vérifiée paresseusement (`getSubscriptionState`) ; upgrade/downgrade → le paiement le plus récent fait foi, les autres passent `resilie` |
| `transaction_paiement` | `id`, `abonnement_id*`, `user_id*`, `montant`, `moyen`, `statut` (`en_attente/reussi/echoue/rembourse`), `reference` (**UNIQUE**), `provider` (`demo/cinetpay`), `provider_ref`, `created_at` | **Idempotence** : `reference` UNIQUE + garde `WHERE statut='en_attente'` → double webhook = pas de double activation |

## Pilotage (§2.2 / §2.3 / §3.3)

| Table | Colonnes | Notes |
|---|---|---|
| `objectif` | `id`, `laboratoire_id*`, `campagne_id*`, `produit_id*`, `user_id*` (nullable = objectif de zone), `region_id*`, `district_id*`, `objectif`, `debut`, `fin`, `created_at` | **Produit phare par zone** (§2.3). Progression = visites validées du délégué dans la zone/période |
| `notification` | `id`, `laboratoire_id*` (nullable), `from_user_id*` (nullable), `to_user_id*`, `message`, `lu` (0/1), `created_at` | **Messagerie labo ↔ délégué** (§2.2) + notifications d'activation |

## Flux clés

```
Inscription délégué → users(role=delegue, laboratoire_id choisi)
  → POST /api/abonnements/initier {formule_id} → abonnement(en_attente) + transaction(reference UNIQUE)
  → paiement CinetPay (notify_url = /api/webhooks/cinetpay)
  → webhook : vérif API CinetPay + garde statut='en_attente' → abonnement(actif, date_debut/expiration +30 j)
  → échéance : getSubscriptionState met à jour en_attente→actif / actif→arrive_expiration→expire
```

## Note SQLite dev vs PostgreSQL prod

- `node:sqlite` : placeholders `?`, AUTOINCREMENT. Base jetable `data/delegpharma.db` — recréée au seed.
- PostgreSQL 16 : placeholders `$n`, `SERIAL`, `RETURNING id` (adapté par `db.js`).
- Les index sont recréés en PostgreSQL après la DDL (adaptation `.replace` du DDL SQLite).
