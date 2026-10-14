# Demande backend — 2026-10-14 — Q-pièce : calendrier annuel de passation et canevas de rapport d'évaluation

## Contexte

Arbitrage du pilote du 14/10 sur la question **Q-pièce** du manuel révisé (`docs/manuel-controle-revise-2026-10-10-application.md`,
§22). Deux pièces du dossier d'appel d'offres (DAOO et sous-types voisins) étaient encore demandées en fichier alors que leurs
données sont, ou seront, dans l'application :

1. **Calendrier annuel de passation mis à jour et signé** — *« la saisie du calendrier annuel de passation est obligatoire lors de
   la création du plan de passation »* ; précisé : **toutes les étapes datées**.
2. **Canevas de rapport d'évaluation** — *« le modèle de canevas dépend du sous-type de dossier ; c'est ce canevas qui sera utilisé
   à l'étape de l'évaluation des offres »* ; précisé : **les modèles sont fournis par le pilote**.

Aujourd'hui (constat front) : la saisie du plan exige **au moins un** processus daté par ligne (« Datez au moins un processus »,
`ppm-saisie-grid`, et la soumission « au moins un processus pour tous les marchés ») ; le rapport d'évaluation suit un plan unique,
celui du guide (livré le 07/10) ; les deux pièces figurent dans les pièces exigées du sous-type (`t_piece_sous_type`).

## B1 — Le calendrier complet, obligatoire dans le plan

Chaque ligne du plan date **tous** les processus du modèle de calendrier (CAPM) de son mode de passation (date de début ; date de fin
facultative, comme aujourd'hui). Refus nommé à l'enregistrement de la ligne et à la soumission du plan (par exemple
`CAPM_INCOMPLET`, avec la ligne et les processus non datés en `details`), à la création comme à chaque nouvelle version.

## B2 — Le calendrier annuel produit par l'application

Un document « Calendrier annuel de passation » produit à partir du plan (toutes les lignes de l'exercice, leurs processus et leurs
dates), lisible en PDF depuis le dossier de planification et depuis le dossier d'appel d'offres qui en dépend. La pièce « Calendrier
annuel de passation mis à jour et signé » **n'est plus demandée** au dossier conduit dans l'application (même logique que la
tranche R2 : la validation tracée vaut signature).

## B3 — Le canevas de rapport par sous-type

La pièce « Canevas de rapport d'évaluation » **n'est plus demandée** au dépôt du dossier conduit dans l'application. Le rapport
d'évaluation est produit sur le **canevas du sous-type** du dossier (DAOO, DAOOI, DAOOPREQUAL, DAOR, DAORI, DC…). Les modèles seront
**fournis par le pilote** ; tant qu'un sous-type n'a pas le sien, le plan du guide actuel reste utilisé. Dire comment les modèles
seront intégrés (gabarits du code, comme les modèles de PV, ou référentiel administrable) et ce que le front doit afficher (le canevas
utilisé, nommé sur le rapport ?).

## Hypothèses (à confirmer ou corriger)

- H1 — B1 ne s'applique qu'aux plans **créés ou mis à jour** après la livraison ; un plan déjà contrôlé n'est pas invalidé. Son
  calendrier annuel (B2) est produit avec les dates qu'il a, les processus non datés apparaissant comme tels.
- H2 — Un processus du modèle peut-il être « sans objet » pour une ligne (étape qui n'existe pas pour ce marché) ? Si oui, comment
  le marquer pour qu'il compte comme renseigné ; sinon, tous les processus du modèle sont exigés.
- H3 — L'import PDF du plan reste accepté s'il ne porte pas toutes les dates ; le manque est signalé à la revue de transcription et
  bloque la soumission (B1), pas l'import.
- H4 — Pour un dossier **saisi hors de l'application** (dossier vide), les deux pièces restent exigées, comme le reste de sa liste
  (« les listes des dossiers saisis ne changent pas », R2).
- H5 — B3 vaut pour tous les sous-types qui ont une évaluation dans l'application (appels d'offres et consultation PI).

## Ce que le front fera

- Saisie du plan : « tous les processus du modèle » au lieu de « au moins un » (garde de la grille et de la soumission, message
  nommant les processus manquants), aligné sur le refus de B1.
- Pièces du dossier : rien à coder si la liste vient du serveur ; affichage du calendrier annuel produit (B2) et du canevas utilisé
  (B3) selon le contrat retenu.

> ✅ **Backend, 2026-10-14 — réponse (arbitrages de l'utilisateur au backend le 14/10 : H2 « oui, marqué sans objet par la PRMP »,
> H1 « toute soumission future », B3 « attendre les modèles du pilote »).** Deux tranches livrées, Q1 (V114) et Q2 (V115).
>
> **B1 — livré, avec un écart.**
> - `ProcessusMarche` (saisie) et `MarchePrevisionDto` (`/api/marche-previsions`) gagnent **`sansObjet`** (absent = `false`) et
>   **`motifSansObjet`** (500 car.). Sans objet → aucune date (400 champ `…sansObjet`) et un motif (400 champ `…motifSansObjet`) ;
>   sinon `dateDebut` obligatoire (400 champ `…dateDebut`, message inchangé). Relu sur `GET /api/marche-previsions`, recopié dans une
>   nouvelle version du plan, figé dans l'archive de rectification (`PrevisionVersion.sansObjet` / `motifSansObjet`).
> - **409 `CAPM_INCOMPLET`** à `POST /api/dossiers/{id}/soumettre` (plan, création comme mise à jour) : chaque ligne non retirée doit
>   avoir **chaque processus de la grille de son mode** (`GET /api/capm?mode=`) daté ou sans objet. `details.lignes` =
>   `[{idDetail, designation, processus: [libellés manquants, ordre de la grille]}]`. Mode sans grille → rien d'exigé.
> - ⚠️ **Écart : pas de refus à l'enregistrement de la ligne.** La saisie, l'import PDF et la mise à jour par import passent par le
>   même enregistrement ; l'import ne lit que trois dates (H3 : il doit rester accepté) et un brouillon se complète en plusieurs fois.
>   « Au moins un processus » reste exigé à l'enregistrement ; la garde de la grille côté front fait le reste, et le serveur tranche
>   à la soumission. La **resoumission** d'un plan en rectification ne rejoue pas la règle (plan soumis avant, H1).
>
> **B2 — livré.** `GET /api/dossiers/{idDossier}/calendrier-annuel` → PDF (garde de lecture du dossier). Depuis le plan lui-même, ou
> depuis un dossier produit par une fiche marché (plan de la ligne en vigueur) ; un dossier sans plan dans l'application → 409
> `CALENDRIER_INDISPONIBLE`. Par ligne : Processus / Début / Fin, « sans objet » et son motif, ou « non daté » (plan antérieur, H1).
> La pièce `CALENDRIER` passe en `CONDITION = 'PAPIER'` (V115) : plus servie par `GET …/pieces-exigees` au dossier en ligne.
>
> **B3 — en partie.** La pièce `CANEVAS_RAPPORT` passe aussi en `PAPIER` (V115). Le canevas par sous-type **attend les modèles du
> pilote** : leur forme décidera de l'intégration (gabarits du code comme les modèles DAO, ou référentiel). Jusque-là, le rapport
> reste sur le plan du guide ; rien à afficher de plus pour le moment.
>
> **H1** confirmée (toute soumission postérieure à la livraison ; plans antérieurs rendus avec leurs trous). **H2** : oui, marqué par
> la PRMP avec un motif. **H3** confirmée. **H4** confirmée (condition `PAPIER` : le dossier saisi garde les deux pièces). **H5** :
> confirmée pour la suite de B3.

> ✅ **Front, 2026-10-14 — B1 et B2 branchés** (tests, build, lint ; fenêtre du calendrier vérifiée dans le navigateur sur V115) :
> - **Saisie du plan** (`ppm-saisie-grid`) : chaque processus du modèle porte une case « Sans objet » ; cochée, les dates se vident et
>   se verrouillent et un **motif** est exigé ; la fenêtre compte les processus « ni datés ni sans objet » (« le plan ne pourra pas
>   être soumis en l'état ») ; un brouillon s'enregistre incomplet, comme le serveur l'accepte. L'aperçu avant création nomme, par
>   ligne, les processus à compléter. La requête passe par une seule fonction (`PpmFormFactory.processusPourEnvoi`) : daté (début,
>   fin facultative) ou sans objet (aucune date, le motif).
> - **Détail d'un plan** (`detail-ppm-modal`, `/api/marche-previsions`) : même case et même motif, création comme édition.
> - **Lecture** : « Sans objet — motif » dans les dates d'un marché, « sans objet » dans les colonnes de dates du plan officiel.
> - **Soumission** : 409 `CAPM_INCOMPLET` nommé ligne par ligne (`details.lignes`) par `messageSoumissionRefusee`, donc sur chaque
>   écran qui soumet un plan.
> - **B2** : bouton « Calendrier annuel de passation (PDF) » dans l'onglet « Plan de passation » d'un plan et dans les pièces d'un
>   dossier né d'une fiche ; 409 `CALENDRIER_INDISPONIBLE` nommé — lu dans le corps binaire du refus (requête en `blob`, que
>   `codeErreur` ne lit pas).
> - B3 : rien à brancher tant que les modèles du pilote ne sont pas fournis.
