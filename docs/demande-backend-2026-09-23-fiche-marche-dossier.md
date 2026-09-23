# Demande backend — Relier la fiche marché au dossier soumis à la CNM (lot 1b)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat du pilote, dossier n° 100332
(famille DMC, sous-type `DAO`, six pièces PDF jointes à la main) — **sa page ne dit rien de la fiche marché, et ne
peut rien en dire : aucune colonne ne relie les deux objets.** Suite de
`docs/demande-backend-2026-09-22-fiche-marche-dao.md` (lot 1, livré et recetté le 22/09).

**Arbitrage pilote du 23/09** : entre « la fiche produit le dossier » et « le dossier accueille la fiche », le pilote a
suivi la recommandation du front : **la fiche produit le dossier** (B2), le rattachement d'un dossier existant restant
un **secours** pour les dossiers déjà créés, dont le n° 100332 (B3).

## Constat (vrai au 23/09, lu sur le code)

Deux objets vivent côte à côte sans se connaître :

| | Dossier soumis à la CNM | Fiche marché |
|---|---|---|
| Table | `t_dossier` (famille DMC, `ID_SOUS_TYPE = 'DAO'`) | `t_fiche_marche` → `t_dossier_mec` (`ID_DMC`) |
| Créé par | « Créer dossier » (`POST /api/saisies/dossier`) : sous-type, entité, localité | `POST /api/dmcs/par-marche/{idDetail}` : **ligne du PPM** |
| Contenu | pièces PDF jointes à la main | 138 champs structurés (22 du PPM, 12 du cadrage, 104 saisis) |
| Lien entre les deux | **aucun** — `t_dossier_mec` ne porte que `ID_DETAIL`, `t_dossier` ne porte rien | |

Conséquences immédiates : la page d'un dossier `DAO` ne peut pas montrer sa fiche ; la PRMP ressaisit l'entité et la
localité que la ligne du PPM connaît déjà ; et **le lot 2 n'aura nulle part où déposer** le DPAO, l'acte d'engagement
et le CCAP qu'il génère.

## Demande

### B1 — La liaison (`t_dossier.ID_DMC`)

- **`t_dossier`** reçoit **`ID_DMC` bigint NULL**, clé étrangère vers `t_dossier_mec`, **unique** (un DMC produit au
  plus un dossier ; un dossier porte au plus une fiche). Migration seule, aucune reprise de données : les dossiers
  existants restent à `NULL`.
- La colonne n'a de sens que pour la **famille DMC**. Contrainte facultative (à votre main) : `CHECK` liant
  `ID_DMC IS NOT NULL` au sous-type `DAO`, ou simple garde de service.
- **`DossierDto`** porte `idDmc` et, quand il est présent, un bloc **`ficheMarche`** réduit :
  `{ idDmc, idDetail, refeDossierPpm, designationMarche, typeMarche, statut, version, nbSaisis, nbAttendus }` —
  de quoi que la page du dossier affiche l'état de la fiche **sans second appel**. Absent si `ID_DMC` est nul.

  > ⚠️ **Livraison backend du 2026-09-23 — le bloc `ficheMarche` n'est servi que sur la lecture unitaire**
  > (`GET /api/dossiers/{id}` et les réponses des gestes sur un dossier). Les **listes** portent `idDmc` seul : le
  > résumé relit le plan et recalcule le bilan des contrôles, ce qu'une liste ne paie pas. La page du dossier, qui lit
  > à l'unité, a bien tout sans second appel. Le `CHECK` est posé (V36), doublé de la garde de service.
- Réciproquement, `FicheMarcheDto` et `DmcDto` portent **`idDossier`** (le dossier soumis, nul tant qu'il n'existe pas)
  — le front y met le lien « voir le dossier » à l'étape 7 de la fiche.

  > ⚠️ **Livraison backend du 2026-09-23 — le champ s'appelle `idDossierSoumis`**, sur `FicheMarcheDto` comme sur
  > `DmcDto` (`GET /api/dmcs/{id}`, `GET /api/dmcs/par-marche/{idDetail}`). Raison : `FicheMarcheDto.idDossier`
  > **existe déjà** depuis le lot 1 et désigne le dossier de **planification** de la ligne (celui dont le journal
  > reçoit `FICHE_MARCHE_VALIDEE`) ; lui changer de sens aurait cassé le contrat du 22/09 sans bruit. Le lien « voir
  > le dossier » lit `idDossierSoumis`.

### B2 — La fiche produit le dossier (chemin principal)

**`POST /api/fiches-marche/{idDmc}/dossier`** (PRMP, la même qui valide) → crée le dossier DMC de sous-type `DAO` et
le relie à la fiche ; renvoie le `DossierDto` créé (201).

- **Gardes**, dans cet ordre : 404 fiche inconnue → 403 hors périmètre → vacance de mandat → 409 à code stable :
  `FICHE_NON_VALIDEE` (la fiche doit être `VALIDEE` : on ne crée un dossier que sur un contenu figé),
  `DOSSIER_EXISTANT` (`ID_DMC` déjà lié — renvoyer l'`idDossier` dans le corps pour que le front y navigue),
  `DMC_NON_DAO`.

  > ⚠️ **Livraison backend du 2026-09-23 — ordre des 409 : `DMC_NON_DAO` → `DOSSIER_EXISTANT` → `FICHE_NON_VALIDEE`.**
  > Un DMC non DAO n'a pas de fiche (il échouerait sinon en `FICHE_NON_VALIDEE`, moins parlant) ; et une fiche qui a
  > déjà produit son dossier le dit **même si une révision a été ouverte depuis** — le front navigue au lieu d'afficher
  > « validez d'abord ». « Fiche `VALIDEE` » = **dernière version** validée : une révision en cours bloque. Le numéro
  > du dossier existant est dans le champ **`idDossier`** du corps d'erreur (nouveau, absent de tous les autres 409 sauf
  > `FICHE_DEJA_LIEE`). Profil : **PRMP seule** (403 pour l'UGPM).
- **En-tête dérivé de la ligne du PPM**, sans rien redemander : entité contractante, localité, PRMP, exercice — les
  mêmes valeurs que `valeursPpm` sert déjà. Le dossier naît en **`BROUILLON`**, comme aujourd'hui.

  > ⚠️ **Livraison backend du 2026-09-23 — entité et localité de la ligne courante, comme demandé ; la PRMP est celle
  > qui produit le dossier, et il n'y a pas d'exercice.** Le dossier appartient à la PRMP qui le crée et fige son mandat
  > d'attribution, comme toute saisie (spec « Mandats PRMP ») : c'est la même que celle du plan tant qu'aucun
  > changement de PRMP n'a eu lieu, mais après une passation, attribuer le nouveau dossier au prédécesseur l'aurait
  > rendu invisible de son successeur. `t_dossier` ne porte pas d'exercice : rien à reprendre (il reste lisible dans la
  > fiche, `PPM_EXERCICE`). Journal : **`CREATION` puis `DOSSIER_CREE_DEPUIS_FICHE`** (deux lignes, la première garde
  > l'auteur de la création comme pour tout dossier).
- **Pièces attendues** : celles du sous-type `DAO` (référentiel `type-piece-jointes`), inchangées. Au lot 1b elles
  restent toutes à joindre à la main ; au **lot 2**, « Dossier d'appel d'offres complet » sera **produit** depuis la
  fiche et joint automatiquement, les autres (cahier des clauses techniques particulières, avis d'appel d'offres,
  estimation du coût, garantie de soumission, cahier des clauses administratives générales) restant manuelles.
- **Journal** du dossier : `DOSSIER_CREE_DEPUIS_FICHE` (détail « fiche marché version n, N informations »).
- La **soumission** à la CNM ne change pas : geste existant du dossier, avec ses pièces obligatoires.

### B3 — Rattacher un dossier existant (secours)

**`PUT /api/dossiers/{idDossier}/fiche-marche`**, corps `{ idDmc }` (PRMP / UGPM propriétaires) → pose `ID_DMC`.

- 409 à code stable : `DOSSIER_NON_BROUILLON` (on ne rattache pas un dossier déjà transmis à la CNM),
  `DOSSIER_NON_DAO`, `FICHE_DEJA_LIEE` (le DMC porte déjà un autre dossier), `DOSSIER_DEJA_LIE`.
- **`DELETE /api/dossiers/{idDossier}/fiche-marche`** défait le rattachement tant que le dossier est en brouillon
  (erreur de manipulation), journal `FICHE_MARCHE_DETACHEE`.
- **`GET /api/fiches-marche/rattachables?idDossier=`** → les fiches **validées et non encore liées** du périmètre,
  `[{ idDmc, idDetail, refeDossierPpm, designationMarche, version, dateValidation }]` : de quoi que le front propose
  une liste courte sur la page du dossier n° 100332 plutôt qu'une saisie d'identifiant.

  > ⚠️ **Livraison backend du 2026-09-23 — précisions de B3.** (1) Le `PUT` refuse aussi **`FICHE_NON_VALIDEE`**
  > (même règle que B2 : seule une fiche dont la dernière version est validée se lie) et **`DMC_NON_DAO`** ; rattacher
  > la fiche **déjà liée à ce même dossier** ne change rien (200). (2) `FICHE_DEJA_LIEE` porte l'**`idDossier`** qui la
  > tient, comme `DOSSIER_EXISTANT`. (3) `PUT` et `DELETE` renvoient le **`DossierDto`** (200, pas 204) ; un `DELETE`
  > sur un dossier sans fiche ne fait rien (200, pas de journal). (4) Journal du rattachement : **`FICHE_MARCHE_RATTACHEE`**
  > (non demandé, symétrique du détachement). (5) `rattachables` : **PRMP et UGPM** seulement (403 aux autres
  > profils) ; `idDossier` est facultatif et ne filtre pas la liste — un dossier inconnu ou invisible de l'appelant la
  > rend **vide** (200). Ordre des gardes du `PUT` : 404 → 403 (dossier d'autrui, puis plan hors périmètre) → vacance →
  > `DOSSIER_NON_BROUILLON` → `DOSSIER_NON_DAO` → `DMC_NON_DAO` → `DOSSIER_DEJA_LIE` → `FICHE_DEJA_LIEE` → `FICHE_NON_VALIDEE`.

### B4 — Lecture par la Commission

Les contrôleurs qui peuvent lire le dossier lisent **aussi** sa fiche (`GET /api/fiches-marche/{idDmc}` l'autorise
déjà pour « les contrôleurs du périmètre »). Rien à ajouter ici : c'est le bloc `ficheMarche` du `DossierDto` qui leur
ouvre le chemin. L'examen **porte toujours sur les pièces** ; les points de contrôle sur la fiche restent le lot 5 (H2).

### Options écartées

- *Porter `ID_DOSSIER` sur `t_dossier_mec`* plutôt que l'inverse : le DMC est un objet de **préparation**, le dossier
  l'objet du **circuit** ; c'est le dossier qui gagne un attribut, comme il en gagne pour son PPM.
- *Créer le dossier dès la création de la fiche* : une fiche abandonnée laisserait un dossier vide dans « Mes
  brouillons ». Le dossier naît d'un contenu **validé**.
- *Fusionner les deux objets* : le circuit, les pièces, le PV et le chronométrage vivent sur `t_dossier` ; la fiche
  n'a pas à en hériter.

## Tests attendus (recette backend)

1. Migration : `ID_DMC` nullable et unique sur `t_dossier` ; les dossiers existants restent à `NULL` et se lisent
   comme avant (`ficheMarche` absent du DTO).
2. Fiche `BROUILLON` → `POST …/dossier` 409 `FICHE_NON_VALIDEE` ; fiche `VALIDEE` → 201, dossier `BROUILLON`, entité et
   localité **égales à celles de la ligne du PPM**, journal +1 ; second appel → 409 `DOSSIER_EXISTANT` portant l'`idDossier`.
3. `GET /api/dossiers/{id}` du dossier créé : `idDmc` posé, bloc `ficheMarche` complet ; `GET /api/fiches-marche/{idDmc}` :
   `idDossier` posé.

   > ⚠️ **Livraison backend du 2026-09-23** : c'est `idDossierSoumis` qui est posé (voir B1) ; `idDossier` reste le
   > plan. Recette : `FicheMarcheDossierIntegrationTest`, sept cas, un par point de cette liste.
4. Rattachement : dossier `DAO` en brouillon + fiche validée non liée → 200 ; dossier déjà transmis → 409
   `DOSSIER_NON_BROUILLON` ; sous-type autre que `DAO` → 409 ; fiche déjà liée → 409. `DELETE` défait, puis rattachement
   d'une autre fiche → 200.
5. `rattachables` ne liste que les fiches validées, non liées, du périmètre ; une PRMP étrangère → liste vide (200).
6. Périmètre : autre PRMP → 403 **avant** tout 409 ; PRMP sans mandat actif → refus de vacance sur `POST …/dossier` et
   sur le rattachement.
7. Contrôleur de la localité : lit le dossier **et** sa fiche ; hors périmètre → 403 sur les deux.

## Côté front (développé contre ce contrat)

- **Étape 7 « Documents » de la fiche** : bouton « Créer le dossier à soumettre », puis lien vers le dossier créé ;
  la liste des pièces restant à joindre y est rappelée.
- **Page d'un dossier `DAO`** : encart « Fiche marché » (version, état, informations saisies, lien), ou, si rien n'est
  lié, « Rattacher une fiche marché » avec la liste servie par `rattachables`.
- ~~**En attendant la livraison**, la page d'un dossier `DAO` porte un simple **repère** vers `/prmp/dao`~~ —
  remplacé le 23/09 par l'encart réel, la liaison étant livrée.

**✅ Recette réelle du front, 23/09 (backend `92c7534`, V36)** : la fiche 1 validée en version 3 produit le dossier
**n° 100333** — entité « JIRO SY RANO MALAGASY » et localité « Centrale » reprises de la ligne du plan, sous-type
`DAO`, brouillon, zéro pièce jointe pour l'instant. Sa page montre l'encart « Fiche marché » (validée, version 3,
91 sur 91 informations, ligne du plan, objet) avec « Ouvrir la fiche » et « Détacher ». Détachement puis
rattachement au dossier **n° 100332** du pilote par la liste des rattachables : vert, la page relit le dossier.
Aucune erreur JS.

> ⚠️ **Constat de recette, hors périmètre du lot 1b — les dates du plan de test sont passées.** `DATES_ORDRE`
> compare les dates de la fiche à celles du plan (lancement 09/02/2026, ouverture 09/03, attribution 27/03) : une
> remise d'offres saisie à une date d'aujourd'hui **ne peut plus** entrer dans cet ordre, et la fiche reste bloquée.
> Ce n'est pas un défaut de la règle, c'est un plan dont le calendrier est dépassé. À trancher par le pilote : la
> règle doit-elle comparer aux dates **prévisionnelles du plan** (et donc bloquer tout appel d'offres préparé en
> retard), ou seulement **vérifier l'ordre interne** de la fiche (remise < ouverture < attribution) ?
