# Demande backend — Fiche DAO des travaux : les pièces de l'offre, typées

**Date** : 2026-10-03 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-02-fiche-travaux-structuree.md`,
**lot 4**, lancé par le pilote le 03/10 (« Attaquer maintenant le Lot 4 »), après la clôture des lots 1 à 3. La règle Q4
du plan vaut encore : **les champs texte existants restent en complément**, et la liste fait foi.

**Ce qui manque aujourd'hui.** La clause 6.2 du DPAO-T imprime :
- 1° « Documents ou pièces à remettre en sus… » : `B04-PI-01`, un texte libre, obligatoire ;
- 2° les pièces administratives : `B03-CQ-01`, un texte libre, dont la valeur par défaut est la liste du document type
  (adaptée le 01/10).

Le texte ne dit pas ce qu'une plateforme de dépôt ou la Commission ont besoin de savoir pièce par pièce : son numéro,
sa forme (original, copie certifiée, légalisée), son **ancienneté maximale**, si elle vaut par lot, et le modèle qu'elle
suit. La correspondance avec le DAO du MTP l'a relevé (information sans champ n° 9 : plannings 8-a à 8-e, plan de
charge).

**Les cas réels** (fiches des faits ; DAO non suivis, filigranes nominatifs) :

| | document type (DPAO-T 6.2, 2°) | MEN (`jeu-donnees-men-travaux-faits.md`) | MTP (`jeu-donnees-mtp-routier-faits.md` §4) |
|---|---|---|---|
| **pièces administratives** | 6 : carte professionnelle, État 211 bis **< 3 mois**, extrait RCS, certificat de non-faillite **< 2 mois**, NIF, carte statistique ; toutes en « photocopie certifiée » sauf le certificat | 4, toutes **< 3 mois** : carte d'immatriculation fiscale (copie certifiée), carte statistique (copie certifiée ; le DAO écrit « deux (03) mois »), certificat de non-faillite (original), extrait RCS (original) | pièces **01 à 04**, chacune **< 3 mois** : carte professionnelle 2026 (copie **légalisée par le centre fiscal**), carte statistique, RCS, certificat de non-faillite |
| **autres pièces de l'offre** | « <énumérer ces documents ou pièces> » | garantie de soumission ; liste du personnel ; liste du matériel avec justificatifs ; planning d'exécution ; quittance de l'ARMP ; attestation de visite ; méthodologie d'exécution | pièces **05 à 10** : quittance ARMP ; garantie (B1 ou B2) ; liste du personnel ; liste du matériel ; **plannings 8-a à 8-e** (annexe 5) ; plan de charge ; plus une clé USB |

Les noms de propriétés, de ressources et de jetons ci-dessous sont des **propositions**, à votre main, comme aux lots
précédents.

---

## B1 — Une liste de la fiche : les pièces exigées

### B1.1 — La ressource

Même cycle de vie que `/materiel` et `/personnel` : une liste de la version de fiche, figée à la validation, copiée à la
révision, pour la catégorie **TRAVAUX** (409 hors travaux, comme `MOYENS_HORS_PERIMETRE`).

| Méthode | URL (proposée) | Corps | Réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/pieces` | — | `PieceExigeeDto[]`, dans l'ordre |
| PUT | `/api/fiches-marche/{idDmc}/pieces` | `{ "pieces": [PieceExigeeDto…] }` | toute la liste (remplacement ; l'ordre est la position) |

Une seule liste, avec la **rubrique** de chaque pièce (1° ou 2° de la clause 6.2). Comme au lot 3, il n'y a pas de liste
par lot : un drapeau `parLot` suffit (H1).

> ⚠️ **Livraison backend du 2026-10-03 (§B1.1, V61).** Conforme, **H1** comprise :
> - `GET|PUT /api/fiches-marche/{idDmc}/pieces` ; une liste par fiche, figée à la validation, copiée à la révision,
>   supprimée avec la fiche ;
> - hors travaux, 409 **`PIECES_HORS_PERIMETRE`** ; sur une version validée, 409 `FICHE_VALIDEE`.

### B1.2 — Une pièce

| propriété | type | exemple | règle |
|---|---|---|---|
| `rubrique` | `ADMINISTRATIVE` \| `OFFRE` | `ADMINISTRATIVE` | obligatoire ; 2° ou 1° de la clause 6.2 |
| `numero` | texte ≤ 10, facultatif | « 01 », « 8-a » | le numéro que le DAO donne à la pièce (MTP) |
| `libelle` | texte ≤ 300 | « Carte professionnelle 2026 » | obligatoire |
| `forme` | texte ≤ 200, facultatif | « copie légalisée par le centre fiscal » | original, copie certifiée… |
| `ancienneteMaxMois` | entier ≥ 1, facultatif | 3 | « datée de moins de 3 mois » |
| `parLot` | booléen, défaut `false` | — | une pièce par lot (garantie de soumission d'un lot) |
| `modele` | texte ≤ 200, facultatif | « annexe 5, planning 8-a » | le modèle que la pièce suit |

400 nominatifs (`pieces[i].libelle`…) : rubrique absente ou inconnue, libellé manquant ou trop long, ancienneté < 1.

> ⚠️ **Livraison backend du 2026-10-03 (§B1.2).** Conforme : les noms et règles du tableau, 400 nominatifs `pieces[i].…`. La
> rubrique est reçue **sans casse** (« offre » vaut `OFFRE`) et servie en majuscules.

### B1.3 — Où l'écran la saisit

Un bloc à rendu propre, comme `B12` et `B13` : **proposé `B14` « Pièces de l'offre »**, `rendu = 'PIECES'`, servi au
référentiel des travaux. Les champs `B04-PI-01` et `B03-CQ-01` restent à leur place, en complément.

L'écran proposera en un clic les **six pièces administratives du document type** (rubrique `ADMINISTRATIVE`, avec leurs
formes et anciennetés), que la PRMP ajuste. C'est un geste d'écran, sans rien côté serveur.

> ⚠️ **Livraison backend du 2026-10-03 (§B1.3).** Conforme : bloc **`B14` « Pièces de l'offre »**, `rendu = 'PIECES'`, servi
> aux travaux dans les trois types de marché, comme `B13`. Il a deux rubriques sans champ, `B14-AD` « Pièces
> administratives » et `B14-OF` « Autres pièces de l'offre ». Le geste « six pièces du document type » reste à l'écran.

---

## B2 — L'impression : deux jetons, une ligne par pièce

- **`{{PIECES.administratives}}`** et **`{{PIECES.offre}}`** : une ligne par pièce de la rubrique, dans l'ordre :
  - « - 01 : Carte professionnelle 2026, copie légalisée par le centre fiscal, datée de moins de 3 mois » ;
  - sans numéro : « - Extrait du Registre de Commerce, photocopie certifiée » ;
  - par lot : « …, une par lot » ;
  - avec un modèle : « - 09 : Planning général, selon le modèle : annexe 5, planning 8-a ».
  Les morceaux absents disparaissent avec leur virgule. Liste vide : pointillés.
- **Conditions** : `PIECES.administratives renseigne` et `PIECES.offre renseigne`, sur le modèle de `MOYENS.x renseigne`
  (V60).

C'est **le front** qui recopiera le DPAO-T (clause 6.2), puis vous enverra le modèle, une fois son texte validé par le
pilote :
- 1° : la phrase du document type, puis la liste `OFFRE`, puis `B04-PI-01` s'il est saisi ;
- 2° : la liste `ADMINISTRATIVE`, puis `B03-CQ-01` s'il est saisi.

> ⚠️ **Livraison backend du 2026-10-03 (§B2).** Les jetons proposés sont retenus tels quels :
> - **`{{PIECES.administratives}}`** et **`{{PIECES.offre}}`**, à la lettre de vos exemples ;
> - ordre des morceaux : libellé, forme, « datée de moins de N mois », « une par lot », « selon le modèle : … » ;
> - un mois s'écrit « datée de moins d'un mois » ;
> - rubrique vide : pointillés ;
> - conditions `PIECES.administratives renseigne` / `PIECES.offre renseigne` lues comme `MOYENS.x`.
>
> J'attends le DPAO-T (clause 6.2) après la validation du pilote.

---

## B3 — Les contrôles

- **`PIECES_OFFRE_EXIGEES`** (bloquant) : la fiche dit les pièces de l'offre, par la liste `OFFRE` **ou** par
  `B04-PI-01`, qui devient **facultatif** (H2). C'est la même logique que `MATERIEL_EXIGE`.
- `B03-CQ-01` est déjà facultatif ; pas de contrôle nouveau sur les pièces administratives.
- **Doublon avec la valeur par défaut** : `B03-CQ-01` a pour valeur par défaut la liste du document type. Une PRMP qui
  remplit la liste `ADMINISTRATIVE` imprimerait les pièces deux fois si elle ne vide pas le texte. Proposé : un
  **avertissement** (jamais bloquant) `PIECES_EN_DOUBLE` quand la liste `ADMINISTRATIVE` est remplie **et** que
  `B03-CQ-01` vaut encore sa valeur par défaut (H3). L'écran le dira aussi, au moment de la saisie.

> ⚠️ **Livraison backend du 2026-10-03 (§B3).** Conforme, **H2** et **H3** comprises :
> - **`PIECES_OFFRE_EXIGEES`** est bloquante : la liste `OFFRE`, ou `B04-PI-01`, devenu facultatif. Elle se tait là où
>   `B04-PI-01` n'est pas servi (contrat-cadre), comme `MATERIEL_EXIGE`. Message : « Les pièces de l'offre ne sont pas
>   dites : remplissez la liste des pièces de l'offre, ou « Documents et pièces constitutifs de l'offre ». »
> - **`PIECES_EN_DOUBLE`** est un **avertissement** sur `B03-CQ-01` (rôle porté par le fichier des fournitures, où ce
>   champ commun est décrit). Il s'émet quand la liste `ADMINISTRATIVE` a une pièce et que le texte égale sa valeur par
>   défaut, aux blancs de bord et fins de ligne près ; il est évalué pour les travaux seulement (H4).

---

## Hypothèses

- **H1** — Une liste par fiche, avec `parLot` sur la pièce. Aucun des deux DAO n'a de pièce propre à un seul lot.
- **H2** — `B04-PI-01` devient facultatif, remplacé par la règle `PIECES_OFFRE_EXIGEES` (liste ou texte).
- **H3** — L'avertissement `PIECES_EN_DOUBLE` se juge sur l'égalité de `B03-CQ-01` avec sa valeur par défaut.
- **H4** — Travaux seulement pour ce lot. Les fournitures ont la même clause 6.2 (le 2463 exige aussi des pièces datées) :
  une extension ultérieure, si le pilote la demande, ne changerait que le périmètre.

**Recette attendue** :
- **MTP** : les pièces 01 à 10 numérotées, dont les quatre administratives à 3 mois et « légalisée par le centre
  fiscal », et les plannings 8-a à 8-e avec leur modèle. Le DPAO imprime les deux listes à la clause 6.2, après la
  recopie du front.
- **MEN** : quatre pièces administratives sans numéro ; une fiche sans liste `OFFRE` ni `B04-PI-01` est refusée par
  `PIECES_OFFRE_EXIGEES` ; la révision copie la liste ; `PIECES_EN_DOUBLE` avertit tant que `B03-CQ-01` garde son
  défaut.
- **Soumission en ligne** (hors périmètre, pour mémoire) : cette liste est ce qu'une plateforme de dépôt présenterait
  au candidat, une case de dépôt par pièce avec son ancienneté contrôlable.

> ⚠️ **Livraison backend du 2026-10-03 — recette.**
> - `PiecesFicheTest` :
>   - les lignes du MTP (01, légalisée, 3 mois ; 06 par lot ; 09 avec son modèle) et du MEN (sans numéro) ;
>   - « d'un mois » ;
>   - les 400 ;
>   - une condition `PIECES.offre renseigne` sur un modèle réduit.
> - `FicheDaoTravauxIntegrationTest.piecesDeLOffre`, sur le MEN en deux lots :
>   - `B14` servi ; 409 hors travaux ; 400 sur une rubrique inconnue ;
>   - une fiche sans liste `OFFRE` ni `B04-PI-01` est refusée ;
>   - avec 4 pièces administratives et 2 de l'offre, le contrôle passe ;
>   - `PIECES_EN_DOUBLE` avertit tant que `B03-CQ-01` garde son défaut, et se tait une fois le texte vidé ;
>   - la révision copie la liste.
> - L'impression par le DPAO attend votre recopie ; les pièces 01 à 10 du MTP restent à saisir par la recette front.
> - **Livraison** : migration **V61** et script `docs/referentiel/2026-10-03-pieces-offre-travaux.sql`, passé à blanc sur
>   DBPRS20 (18 valeurs de `B04-PI-01` et 18 de `B03-CQ-01` y sont conservées).
> - Les deux copies du fichier de correspondance des travaux (`B04-PI-01`) et des fournitures (`B03-CQ-01`) sont mises à
>   jour à l'identique.

> ✅ **Front, 2026-10-03.**
> - **Écran aligné** sur la livraison : l'aperçu écrit « datée de moins d'un mois » pour un mois.
> - **DPAO-T, clause 6.2**, rédigé dans `DPAO-T.txt` / `.json` (`verifier.mjs` : 294 sur 294). ⚠️ **Ne pas le recopier
>   encore** : le texte attend la validation du pilote. Quatre conditions :
>   - 1° : `PIECES-OFFRE-LISTE` = `PIECES.offre renseigne`, puis `PIECES-OFFRE-TEXTE` = `B04-PI-01 renseigne` ;
>   - 2° : `PIECES-ADM-LISTE` = `PIECES.administratives renseigne`, puis `PIECES-ADM-TEXTE` = `B03-CQ-01 renseigne`.
>
>   Les 4° (garantie) et 5° (visite) ne changent pas.
> - **Banc de l'import** : aucune fausse valeur. `B04-PI-01` et `B03-CQ-01` sont désormais signalés **ambigus**, pour la
>   même raison qu'au lot 3 : chacun suit, dans la même cellule, le paragraphe du seul jeton de sa liste. Le DPAO-T
>   relit 2 champs de moins.
>
> ✅ **2026-10-03 — texte de la clause 6.2 validé par le pilote, tel quel** (« datée de moins de N mois » compris).
> `DPAO-T.txt` est **à recopier** tel que commité en `7af2b34`.
>
> ✅ **Recette du front, 2026-10-03 (JAR de 07:49) : fiche 32 en révision v6** (écriture avec l'accord du pilote) :
> - **Écran** : le bloc `B14` est atteint directement, par la rangée des blocs, sans rien enregistrer. Les pièces 01 à 10
>   du MTP y sont saisies : 4 administratives à « moins de 3 mois », la 01 « copie légalisée par le centre fiscal », et
>   11 de l'offre, dont les plannings 8-a à 8-e avec leur modèle « annexe 5 ».
> - `PUT /pieces` répond 200 ; la relecture est conforme (15 pièces, dans l'ordre, rubriques et anciennetés). Le
>   contrôle donne **0 bloquant**.
> - L'écran prévient du double emploi : le texte de `B03-CQ-01` de cette fiche (jeu du MEN) s'imprimera sous la liste
>   administrative.
> - **Fiche laissée en brouillon** : je la validerai après votre recopie du DPAO-T, pour lire la clause 6.2 imprimée sur
>   une seule nouvelle version.

> ⚠️ **Livraison backend du 2026-10-03 — DPAO-T recopié** tel que commité en `7af2b34` (clause 6.2 validée par le pilote).
> Il compte 53 conditions déclarées.
> - `verifier.mjs DPAO-T` sur le rendu brut du serveur : 294 sur 294.
> - **Rendu** (`ModelesDaoTravauxTest.piecesDuDpao`) :
>   - au 1° : « - 09 : Planning général, selon le modèle : annexe 5, planning 8-a », puis le texte de `B04-PI-01` ;
>   - au 2° : « - 01 : Carte professionnelle 2026, copie légalisée par le centre fiscal, datée de moins de 3 mois », puis
>     le texte de `B03-CQ-01` ;
>   - au texte seul, pas de pointillés au 1° ni au 2°.
> - La **fiche 32 v6**, laissée en brouillon, peut être validée : sa clause 6.2 sera imprimée sur le nouveau modèle.
