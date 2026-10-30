# Demande backend — 2026-10-30 — Performance : lectures ligne à ligne, cache des référentiels, journal d'audit

## Contexte

À la demande du pilote (30/10), une mesure de performance a suivi l'analyse en domaines du backend. Elle a été faite en lecture
seule, sur la base de recette du 30/10 :

- **Données** : 5 procédures, 36 lignes de plan, 10 dossiers, 136 584 lignes d'audit.
- **Parcours** : 8 profils (PRMP001, PRES001, CCANT01, SECANT1, MEMANT1, VERANT1, RESPRO1, ADMIN01) ont ouvert chaque entrée de
  leur menu, soit 57 écrans et 771 appels à l'API.
- **Rejeu** : chacun des 184 GET distincts a ensuite été rejoué **seul**, pour lui attribuer ses requêtes SQL.
- **Journal** : les requêtes ont été lues dans le journal de PostgreSQL, activé à chaud (`log_min_duration_statement = 0`, sans
  redémarrage), puis remis à l'état d'origine.

La base est presque vide : les durées sont optimistes. **Le nombre de requêtes par appel est le chiffre qui compte** : il croît avec
le nombre de procédures, de lignes ou de dossiers, donc avec la production.

Écrans : médiane 424 ms, 90e centile 700 ms, maximum 1,3 s (`/prmp/dao`, `/prmp/recus`, `/procedures-en-ligne`).

## B1 — Les listes de procédures relisent chaque procédure ligne à ligne

| Appel | Requêtes SQL | Durée | Proportion |
|---|---|---|---|
| `GET /api/dmcs/eligibles` (PRMP) | **818** | 960 ms | ≈ 23 par ligne de plan |
| `GET /api/fiches-marche/en-ligne` (Administrateur, responsable de procédure) | **404** | 360 ms | ≈ 80 par procédure |
| `GET /api/contrats-en-vigueur` (PRMP) | 113 | 150 ms | 2 contrats |

Les mêmes lectures se répètent **pour chaque procédure** dans les trois appels. Pour `eligibles`, sur un seul appel :

| Requête répétée | Fois |
|---|---|
| `t_responsable_procedure where ID_DMC = ? and DATE_RETRAIT is null` | 100 |
| `t_parametre where CLE = ?` | 92 |
| `t_cao_membre where ID_DMC = ? order by RANG` | 86 |
| `t_fiche_marche where ID_DMC = ? order by NUMERO_VERSION` | 59 |
| `t_lot where ID_DETAIL = ?` | 51 |
| `t_fiche_marche_valeur where ID_FICHE = ?` | 40 |
| `tr_champ_fiche_marche where ACTIF = true` — le même référentiel, relu à chaque fiche | 40 |

`en-ligne` a le même profil (55, 52, 45, 25, 20, 20, 20). `DmcService.eligibles` charge déjà en lot ses compteurs, états et numéros
(commentaires du 14 au 20/10) : il reste ce qui est calculé procédure par procédure, vraisemblablement par des services appelés dans la
boucle (responsable, commission, fiche effective).

Demandé :

- charger ces données **une fois pour toute la liste** (une requête par nature, indexée par `ID_DMC`, `ID_FICHE` ou `ID_DETAIL`) ;
- **objectif** : un nombre de requêtes qui ne dépend plus du nombre de procédures, de l'ordre de 20 par appel.

`en-ligne` est le plus urgent : le front le relisait à chaque navigation. Il ne le relit plus qu'au plus toutes les 5 minutes (voir
« Ce que fait le front »), mais l'écran « Procédures en ligne » et l'accueil de l'Administrateur l'appellent toujours.

## B2 — La liste des dossiers relit le plan de chaque dossier

`GET /api/dossiers` (PRMP) : 92 requêtes. Pour chaque dossier sont relus `t_marche`, `t_service_beneficiaire`, `t_marche_prevision`
(avec `t_capm`) et `t_lot` par `ID_DETAIL` (8 fois chacun), ainsi que `t_pv_examen` (6 fois). Demandé : la même lecture en lot qu'en B1.

Moins urgent, même motif :

- `GET /api/pv-examens/definitifs` : 38 requêtes, examens et dossiers relus par PV ;
- `GET /api/receptions` : `t_dossier` relu 10 fois ;
- `GET /api/dispatchs` : `t_reception` relue 10 fois.

## B3 — Les référentiels relus à chaque usage

Pendant la mesure, PostgreSQL a parcouru en entier :

| Table | Lignes | Parcours complets | Lectures par clé dans les requêtes journalisées |
|---|---|---|---|
| `t_parametre` | 4 | 2 104 | 92 dans `eligibles`, 15 dans `contrats-en-vigueur`, 8 dans `GET /api/horloge` |
| `tr_champ_fiche_marche` | 13 | 798 | |
| `t_capm` | 33 | 235 | 33 dans `GET /api/marche-previsions`, une par prévision |
| `tr_profile` | — | 254 | |

Demandé : un **cache en mémoire** de ces référentiels (paramètres, champs de la fiche, processus `t_capm`, profils), **vidé à chaque
écriture** par l'écran d'administration qui les modifie. Aucun n'a de cache aujourd'hui (aucun `@Cacheable` dans le code).

## B4 — Le journal d'audit sans index

`t_audit_log` compte 136 584 lignes, et sa seule clé d'index est `ID_LOG`. Chaque page de l'écran d'audit, et le bandeau
« dernières modifications » des écrans de référentiels (`?size=4&table=…`), exécute :

- un `count(*)` sur toute la table : environ 70 ms ;
- la recherche filtrée (`AuditLogRepository`, l. 51) : environ 70 ms, en parcours complet. Ses filtres facultatifs, écrits
  `(:x = true or …)` et `DATE_ACTION >= coalesce(:debut, DATE_ACTION)`, empêchent d'utiliser un index.

Pendant la mesure : 16 parcours, 1,37 million de lignes lues. La table grossit à chaque écriture de l'application.

Demandé :

- des index sur `DATE_ACTION` et sur `(NOM_TABLE, DATE_ACTION)` ;
- une recherche dont les filtres absents ne figurent pas dans la requête (construction dynamique) ;
- voir Q2 pour le total.

## B5 — Une réponse lourde

`GET /api/marche-previsions` renvoie 146 Ko pour 36 lignes de plan (B3 pour `t_capm`). À regarder seulement si tous les champs
servis ne sont pas lus par l'écran : voir Q3.

## Questions

- **Q1** — Le serveur de production tourne-t-il en **une seule instance** ? Un cache en mémoire (B3) suffit alors ; à plusieurs
  instances, l'invalidation doit être partagée, ou une durée de vie courte acceptée.
- **Q2** — L'écran d'audit a-t-il besoin du **total exact** ? Sans lui, la pagination « page suivante » évite le `count(*)` sur toute
  la table.
- **Q3** — Le contenu de `GET /api/marche-previsions` : le front n'en lit qu'une partie. Je le recense si une réponse allégée est
  envisagée.

## Ce que fait le front (livré avec cette demande)

- **Liste des procédures en ligne** : plus relue à chaque navigation. Elle est relue au changement de compte, au plus toutes les
  5 minutes, et tout de suite après la désignation d'un responsable (`ProceduresEnLigneStore`).
- **Vacance PRMP et compteurs du menu** : au démarrage, la coquille les demandait deux fois en même temps. Un seul appel part
  désormais, et un geste signalé pendant l'appel relance une lecture à son terme.
- **Après la livraison**, la même mesure sera rejouée (scripts prêts) pour comparer les chiffres ci-dessus.

> ⚠️ **2026-10-30 — livraison partielle (PRS20, V153 ; aucun contrat d'API ne change) : B4 livré, B1 et B3 en grande partie, B2 à
> peine, B5 en attente de Q3. Écarts :**
> - **B1 — l'objectif d'un nombre constant n'est pas atteint.** Les trois listes ouvrent une mémoire de lecture le temps de l'appel :
>   chaque donnée d'une procédure n'est plus lue qu'**une fois** (elle l'était jusqu'à 16 fois), et `en-ligne` précharge en une requête
>   par nature responsables, CAO, cérémonies, versions, séances et offres. Mesures sur la base de test : `en-ligne` 342 → 58 requêtes
>   pour trois procédures, `eligibles` sur une procédure évaluée 395 → 76. **Restent ≈ 11 lectures par procédure** (état de la fiche :
>   valeurs, besoin, pièces ; plan : ligne, lots, bénéficiaires, prévision) : les grouper demande une lecture en lot de l'état de la
>   fiche et du plan, à faire dans un second temps. `contrats-en-vigueur` suit la même mémoire, non mesuré sur un jeu équivalent.
> - **B2 — à peine traité** : `GET /api/dossiers` passe l'avis à imprimer par la même mémoire ; la lecture du plan, une par dossier,
>   reste (même chantier que B1). `pv-examens/definitifs`, `receptions`, `dispatchs` inchangés.
> - **B3 — partiel** : `t_parametre` a un cache en mémoire vidé à chaque écriture (Q1 supposée : **une instance**). Le référentiel des
>   champs n'est lu qu'**une fois par appel de liste**, sans cache global ; `t_capm` et `tr_profile` inchangés.
> - **B4 — livré** : index sur `DATE_ACTION` et `(NOM_TABLE, DATE_ACTION)`, recherche construite selon les filtres saisis. Le total
>   reste servi (`count`) en attendant **Q2**.
> - **Q1** : à confirmer par le pilote (une instance en production ?). **Q2**, **Q3** : réponses du front attendues.

> ⚠️ **2026-10-30 — mesure de contrôle du front sur V153** (même parcours, même base : 5 procédures, 36 lignes, 10 dossiers) :
>
> | Appel | Avant | Après V153 |
> |---|---|---|
> | `GET /api/dmcs/eligibles` (PRMP) | 818 SQL · 960 ms | **193 SQL · 210 ms** — reste `t_evaluation_decision` relue 24 fois |
> | `GET /api/fiches-marche/en-ligne` (Administrateur, responsable) | 404 SQL · 355 ms | **111 SQL · 97 ms** — reste `t_marche` relue 10 fois |
> | `GET /api/contrats-en-vigueur` (PRMP) | 113 SQL · 151 ms | 72 SQL · 87 ms |
> | `GET /api/dossiers` (PRMP) | 92 SQL · 185 ms | 88 SQL · 96 ms |
> | `GET /api/horloge` | 8 SQL | 1 SQL (cache des paramètres) |
> | `GET /api/audit-logs` (page de 25, bandeau de 4) | 116 et 122 ms | **26 et 22 ms** |
> | `GET /api/marche-previsions` | 35 SQL | 35 SQL — `t_capm` relu 33 fois (B3 non traité) |
>
> Écrans : médiane 424 → **275 ms**, 90e centile 700 → **375 ms**, maximum 1,3 s → **770 ms** (`/prmp/dao`) ; requêtes SQL de
> l'ensemble des écrans 11 812 → 4 841. `t_audit_log` : 4 parcours complets restent, ceux du `count` (Q2).
>
> **Réponses du front :**
> - **Q2** — l'écran d'audit **affiche le total** (« n entrée(s) », « Page x / y »). Le front peut s'en passer : avec un indicateur
>   « page suivante » servi par le backend, il passerait à des boutons Précédent / Suivant sans total. À décider par le pilote.
> - **Q3** — **pas d'allègement demandé.** Les 146 Ko viennent du volume (1 026 prévisions pour 36 lignes, ≈ 140 octets chacune), pas de
>   champs inutiles. La correction est côté front : 7 écrans lisent **toutes** les prévisions (`GET /api/marche-previsions` sans filtre)
>   alors que le filtre `?marche=` existe ; ils seront réduits au plan ou à la ligne affichés. Un filtre `?dossier=` (toutes les
>   prévisions d'un plan) éviterait un appel par ligne aux écrans qui montrent un plan entier : **besoin B6**, à servir si possible.
