# Demande backend — 2026-10-14 — Q11 : les prix estimatifs dans la fiche DAO

## Contexte

Arbitrage du pilote du 14/10 sur la question **Q11** du manuel révisé (`docs/manuel-controle-revise-2026-10-10-application.md`, §23).
La fiche DAO porte déjà le besoin article par article (désignation, unité, quantité, lot) ; il lui manque le **prix unitaire estimé**.
Faute de lui, le dossier d'appel d'offres exige encore deux pièces signées : « Bordereau des prix estimatifs signé » (fournitures) et
« DQE estimatif signé » (travaux).

Décisions du pilote :
1. **Saisie obligatoire** : un prix unitaire estimé par article du bordereau et du devis quantitatif ; la fiche ne se valide pas sans.
2. **Lecture** : la PRMP et son UGPM, les profils de la Commission nationale, et les membres de la commission d'appel d'offres
   (après l'ouverture des offres). Jamais publiés, jamais montrés aux candidats.
3. **Contrôle bloquant** : pour chaque lot, le total estimé (quantité × prix unitaire) égale le montant du lot au plan.

## B1 — Le prix unitaire estimé de chaque article

Un champ **prix unitaire estimé** (HT, en ariary) sur chaque article du besoin de la fiche, saisi et relu avec lui. Absent des
documents publiés (DAO complet, DPAO, formulaires du candidat, avis), et des réponses servies aux candidats et au public.

## B2 — Les contrôles à la validation de la fiche

- Un article sans prix estimé → validation refusée (contrôle bloquant nommé, par exemple `PRIX_ESTIME_MANQUANT`, avec les articles).
- Pour chaque lot, Σ (quantité × prix unitaire estimé) ≠ montant du lot au plan → validation refusée (par exemple
  `ESTIMATION_ECART`, avec le lot, le total estimé et le montant du plan).

## B3 — Les documents estimatifs produits

À la validation, l'application produit le **devis quantitatif estimatif** (travaux) ou le **bordereau des prix estimatifs**
(fournitures), par lot, et les joint d'office au dossier soumis à la Commission, comme le projet d'avis. Les pièces « Bordereau des
prix estimatifs signé » et « DQE estimatif signé » ne sont plus demandées au dossier conduit dans l'application (condition `PAPIER`,
comme le calendrier annuel en V115) ; un dossier saisi hors de l'application les garde.

## B4 — La lecture des prix estimatifs

PRMP et UGPM (la fiche), profils de la Commission (le dossier et l'écran figé de la fiche), membres de la commission d'appel
d'offres **après l'ouverture des offres** (l'évaluation). Toute autre lecture : sans les prix.

## Hypothèses (à confirmer ou corriger)

- H1 — Montant comparé : le montant **hors taxes** du lot au plan (`MONT_LOT`, à défaut le montant estimatif de la ligne pour un marché
  non alloti), au nouveau montant si la ligne en porte un. Égalité stricte à l'ariary, sans tolérance (le pilote a écarté la tolérance).
- H2 — Marché à commandes : quelle quantité entre dans le total (maximum, minimum, ou quantité indicative) ? Contrat-cadre : même question.
- H3 — Prestations intellectuelles : le « tableau des coûts estimatifs signé » (pièce 10 du dossier de consultation) suit-il la même
  règle (budget détaillé dans la fiche, document produit, pièce retirée) ? Le pilote a tranché pour le bordereau et le devis ; à lui
  confirmer pour la consultation.
- H4 — Dossier de marché : le « bordereau / DQE estimatif signé » demandé au dossier de marché (pièce 10) se produit-il aussi depuis la
  fiche, et se retire-t-il de la même façon ?
- H5 — Une fiche validée avant la livraison n'est pas invalidée ; sa prochaine révision exige les prix.
- H6 — Les indicateurs de prix de l'évaluation (étape 4, offres anormales) utilisent-ils désormais l'estimation de la fiche plutôt que
  le montant du plan ?

## Ce que le front fera

- Saisie du besoin : une colonne « Prix unitaire estimé » par article, avec le total par lot face au montant du plan (écart affiché en
  direct) ; mention « non publié ».
- Contrôles de la fiche : les deux refus nommés.
- Documents : le devis ou le bordereau estimatif dans la liste des documents de la fiche et du dossier.
- Évaluation : les prix estimés lus par la commission d'appel d'offres, selon le contrat retenu.

> ✅ **Backend, 2026-10-14 — réponse** (V116, V117 ; arbitrages de l'utilisateur au backend le 14/10 : H2 « quantité maximum »,
> H3 et H4 « pièce gardée ») :
>
> **B1 — livré.** `ArticleBesoinDto.prixUnitaireEstime` (HT, ariary, deux décimales), fournitures et travaux, **facultatif à
> l'écriture** (brouillon saisi en plusieurs fois ; donné : positif, sinon 400 `articles[i].prixUnitaireEstime`), recopié à la
> révision, servi par `GET …/articles` (lecture de la fiche). Jamais publié : absent de `BesoinEnLigneDto`, des classeurs (BP, DQE,
> TC), de la liste des fournitures, du DAO complet et de l'avis.
>
> **B2 — livré**, contrôles bloquants du bilan (bloc `B12`) : `PRIX_ESTIME_MANQUANT` (« Le lot 2 : un article n'a pas de prix
> unitaire estimé (article 1 — Imprimante). », « n° 001 — … » aux travaux) et `ESTIMATION_ECART` (« Le lot 2 : le total estimé
> (400 000 Ar) n'égale pas le montant du lot au plan (500 000 Ar) : écart de −100 000 Ar. »). Pour l'écart en direct :
> **`FicheMarcheDto.estimations`** = `[{ lot, montantPlan, totalEstime, ecart, nbArticles, articlesSansPrix[] }]` (`lot` nul sur une
> ligne non allotie ; `null` hors du besoin).
> - ⚠️ **Écart : un lot dont le plan ne porte pas de montant n'est pas bloqué**, il reçoit un **avertissement** `ESTIMATION_ECART`
>   (« Le lot 3 n'a pas de montant au plan : son total estimé (…) ne lui est pas comparé. ») — rien à quoi l'égaler, et le défaut
>   est celui du plan, pas de la fiche.
>
> **B3 — livré.** À la validation : `BORDEREAU_ESTIMATIF` (fournitures) ou `DQE_ESTIMATIF` (travaux, par série avec sous-totaux),
> un **PDF par lot**, listés par `GET /api/fiches-marche/{idDmc}/documents` (libellés « Bordereau des prix estimatifs — lot 2 »,
> « Devis quantitatif et estimatif »), jamais dans les documents servis aux candidats ni dans le DAO complet. Joints d'office au
> dossier sous `BORDEREAU_PRIX` / `DQE` ; ces deux pièces passent en `CONDITION = 'PAPIER'` (V117) : plus demandées au dossier en
> ligne, gardées au dossier saisi.
>
> **B4 — livré.** Fiche : lecteurs de la fiche (PRMP et UGPM, Commission, Président, Administrateur). Commission d'appel d'offres :
> `GET /api/fiches-marche/{idDmc}/evaluation/lots/{lot}/estimation` → `{ lot, montantPlan, totalEstime, articles[{ ordre,
> numeroPrix, designation, unite, quantite, prixUnitaireEstime, montant }] }`, évaluation ouverte (404 sinon), lecteurs de
> l'évaluation (403 pour un candidat).
>
> **H1** confirmée (HT ; `MONT_LOT` par rang, ligne non allotie : nouveau montant s'il est porté, sinon montant estimatif ; à
> l'ariary, sans tolérance). **H2** : quantité **maximum** du marché à commandes ; contrat-cadre : sa quantité. **H3** : pièce
> `TABLEAU_COUTS` **gardée** (à confirmer par le pilote). **H4** : `DEVIS_ESTIMATIF` du dossier de marché **gardé** (c'est le devis
> du titulaire). **H5** confirmée (une fiche validée avant reste validée, sans estimatif ; la révision exige les prix). **H6** : les
> indicateurs de prix prennent le total des prix estimés quand chaque article du lot en a un — égal au montant du plan par le
> contrôle, donc sans changement de valeur.

> ✅ **Front, 2026-10-15 — B1 à B4 branchés** (tests, build, lint ; DBPRS20 en V117 après redémarrage ; pas de recette navigateur :
> la base, vidée le 14/10, n'a aucune fiche) :
> - **Saisie du besoin** (`fiche-besoin`) : colonne « Prix unitaire estimé (HT) — non publié » aux fournitures et aux travaux, envoyée
>   au `PUT …/articles`, recopiée par « reprendre un autre lot » ; sous la grille, le **bilan du lot en direct** — total estimé
>   (quantité maximum d'un marché à commandes, H2), montant du lot au plan (`FicheMarcheDto.estimations`), écart (« la validation de la
>   fiche sera refusée »), articles sans prix ; un lot sans montant au plan est dit non comparé (l'écart du backend).
> - **Contrôles** : `PRIX_ESTIME_MANQUANT` et `ESTIMATION_ECART` arrivent par le bilan de la fiche, avec le message du serveur.
> - **Documents** : `BORDEREAU_ESTIMATIF` et `DQE_ESTIMATIF` dans les pièces produites (libellé du serveur, repli « … (non publié) »).
> - **Commission d'appel d'offres** (B4) : à l'étape des offres anormales, volet « Estimation détaillée de la PRMP (non publiée) », lu à
>   l'ouverture (`GET …/evaluation/lots/{lot}/estimation`), article par article ; 404 → « pas d'estimation détaillée » (fiche validée
>   avant la règle, H5).
> - H3 (tableau des coûts PI) : reste au pilote.
