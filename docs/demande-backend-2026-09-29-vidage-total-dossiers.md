# Demande backend — DBPRS20 : remise à zéro de toutes les données de dossiers

**Date** : 2026-09-29 · **Émetteur** : front, sur décision du pilote (« remettre à zéro les données de tous les
dossiers, c'est-à-dire réinitialiser ») · **Exécutant** : backend (choix du pilote).

## B1 — Vider DBPRS20, au périmètre du 25/09, sans resemis

Périmètre retenu par le pilote : **le même que le vidage du 25/09**
(`docs/demo/vidage-total-dossiers-2026-09-25.sql`), **sans resemis**.

- **Supprimé** : tous les dossiers, PPM, lignes de marché, DMC et fiches DAO (versions, valeurs, documents produits),
  avec tout ce qui en dépend : lots, tranches, bénéficiaires, prévisions, échéances, anomalies, pièces jointes, circuit,
  examens, PV, observations et leur suivi, lettres de renvoi, versions archivées, instantanés, journal des dossiers,
  notifications, messages, demandes de retrait.
- **Gardé** : référentiels (dont celui des champs de la fiche, tel que f7d27df l'a laissé), comptes, mandats, intérims,
  journal technique (`t_audit_log`), indicateurs agrégés, compteurs de référence (`t_sequence_reference`).

## B2 — Mettre le script à jour avant de le rejouer

Le script du 25/09 date d'avant V43. Les migrations passées depuis ont pu ajouter des données rattachées à une fiche,
un DMC, un dossier ou une ligne, que le script ne connaît pas. Repérées côté front, **sans garantie d'exhaustivité** :

Pour chacune, le backend dit si c'est une donnée de dossier (à vider) ou du paramétrage (à garder) :

| Migration | À examiner |
|---|---|
| V44 | observations portant sur un champ de la fiche |
| V45 | `t_fiche_article`, `t_fiche_caracteristique` (besoin de la fiche) |
| V49 | rectification du dossier DAO |
| V50 | `t_parametre_interne_procedure`, `t_parametre_interne_journal`, `t_responsable_procedure` (remise électronique) |
| import du DAO (89f8bb3) | journal `FICHE_IMPORTEE` |

Attendu : l'inventaire vient des **clés étrangères de la base**, pas de cette liste. Une table de données de dossier
oubliée ferait échouer la transaction (sans dégât), ou laisserait des restes sans clé étrangère ; c'est ce second cas
qui compte. Le script mis à jour est un **nouveau fichier daté** ; celui du 25/09 reste tel quel.

## B3 — Exécution et preuve

- Une transaction ; `ON_ERROR_STOP` ; rejouable sur une base déjà vide.
- **Comptes avant et après** dans l'encadré : dossiers, PPM, lignes, DMC, versions de fiche, valeurs, documents,
  examens, PV, pièces. Après : tout à 0.
- Serveur de recette **redémarré** après le vidage (caches).
- Contrôle écran rapide : `GET /api/dossiers` et `GET /api/dmcs/eligibles` renvoient une liste vide, et les écrans
  PRMP tiennent sur une base vide (0 erreur 5xx), comme vérifié le 25/09.

## Conséquences, assumées par le pilote

- **La fiche 27** (ligne 303095, seul contrat-cadre, banc de l'import du DAO) et **le dossier 2463** disparaissent.
  Les mesures de l'import (`scripts/import-dao/mesurer.mjs --dmc=27`, `--dmc=16`) ne tournent plus avant qu'une
  démonstration soit remontée. Les documents et PDF déjà extraits dans l'espace de travail du front restent
  utilisables comme fichiers.
- Les **CCAP produits avec l'article 3 erroné** (depuis D2) disparaissent avec leurs fiches : ce point en suspens se
  referme de lui-même.
- Les **214 valeurs** conservées des champs retirés le 29/09 disparaissent aussi.
- Pour remonter une démonstration plus tard : saisir un PPM, le faire signer, puis `node scripts/demo-dao.mjs <idDetail>`.

## Ce que le backend rend

Le script daté, les comptes avant/après et le redémarrage, dans un encadré ⚠️ daté ici. Toute table ajoutée au
périmètre, ou laissée volontairement hors du périmètre, y est nommée avec sa raison.
