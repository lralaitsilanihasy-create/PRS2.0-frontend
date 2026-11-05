# Demande backend — 2026-11-05 — Grille du dossier de marché : rattacher chaque point à l'élément du dossier qu'il contrôle

## Contexte

À l'examen d'un **dossier de marché** (famille DDM, ex. 00003/MAOO/CNM/2026), chaque élément du dossier s'ouvre dans un onglet :
Fiche de présentation, PV de la CNM (DAO), Informations du DAO, Séance d'ouverture, Rapport d'évaluation, Attribution, Bordereau
estimatif, Pièces jointes. Ouvrir un onglet réduit la grille du dossier aux points qui le concernent (27/10).

Ce rattachement est aujourd'hui **deviné par l'écran** sur le libellé du point (mots « rejet », « DAO », « remise des offres »…).
Résultat constaté par le pilote le 05/11 : « PV de la CNM (DAO) » et « Pièces jointes » montrent les 21 points ; un même point tombe
dans des onglets sans rapport ; un point ajouté par l'Administrateur n'est rattaché à rien. Le pilote demande que **la grille associée
à chaque élément du dossier soit spécifiée**, et qu'elle le soit dans le **référentiel** (administrable), pas dans l'écran.

Lu le 05/11, en lecture seule (ADMIN01) : `GET /api/points-ctrls?sousType=MAOO` sert 21 points de portée `DOSSIER` ; l'entité
`PointsCtrl` ne porte aucune notion d'élément (colonnes : libellé, description, ordre, obligatoire, famille, sous-type, portée,
catégorie, forme, sous-types exclus).

## B1 — Un champ `elements` sur le point de contrôle

- `PointsCtrl.elements` : la liste **ordonnée** des éléments du dossier que le point contrôle — le **premier est l'élément principal**
  (celui qui porte ses données), les suivants ceux où il se vérifie aussi. Vide ou nul : le point ne se rattache à aucun élément
  (il reste dans « Tous les points »).
- Codes (ceux des onglets de l'examen) : `PRESENTATION`, `PV_CNM`, `DAO`, `SEANCE`, `EVALUATION`, `ATTRIBUTION`, `BORDEREAU`, `PIECES`.
  Un code inconnu est refusé (400 nominatif sur `elements`).
- Forme à votre choix (colonne texte à virgules comme `SOUS_TYPES_EXCLUS`, ou table de liaison) ; servi en **tableau de chaînes**.
- Servi par `GET /api/points-ctrls` (toutes ses variantes, dont `?sousType=`) et par ce qui sert la grille à l'examen ; écrit par le
  `PUT`/`POST` d'administration des points.

## B2 — Le rattachement des 21 points de la grille du dossier de marché (validé par le pilote le 05/11)

Migration de données, idempotente, par `ID_POINT_CTRL` (identifiants lus en recette le 05/11 ; à rapprocher par libellé si la base diffère) :

| Id | Point | `elements` (principal d'abord) |
|---|---|---|
| 33 | CAO désignée, membres déclarés | `SEANCE`, `PIECES` |
| 34 | PV d'ouverture signé et publié | `SEANCE` |
| 102 | PV d'ouverture : date et heure | `SEANCE` |
| 103 | PV d'ouverture : quorum et signataires | `SEANCE` |
| 101 | Délai de remise des offres | `SEANCE`, `DAO` |
| 104 | Conformité des documents essentiels | `SEANCE`, `EVALUATION` |
| 35 | Rejets motivés par le DAO | `EVALUATION`, `DAO` |
| 36 | Montant évalué conforme au DAO | `EVALUATION`, `BORDEREAU` |
| 37 | Offres anormales : justification demandée | `EVALUATION` |
| 171 | Offres anormales : processus et seuils | `EVALUATION`, `DAO` |
| 38 | Classement et attributaire proposé | `EVALUATION`, `ATTRIBUTION` |
| 39 | Post-qualification sur les seuls critères du DAO | `EVALUATION`, `DAO` |
| 107 | Qualification : activités et critères | `EVALUATION`, `DAO` |
| 105 | Spécifications techniques | `EVALUATION`, `DAO` |
| 106 | Moralité des prix | `EVALUATION`, `BORDEREAU` |
| 40 | Rapport signé de tous les membres | `EVALUATION` |
| 108 | PV de validation cohérent | `EVALUATION` |
| 41 | Projet de marché conforme à l'offre retenue | `ATTRIBUTION` |
| 109 | Validité de l'offre retenue | `ATTRIBUTION` |
| 169 | Offre retenue acceptable | `ATTRIBUTION`, `PRESENTATION`, `BORDEREAU` |
| 170 | Publicité effective de l'avis | `PIECES` |

Aucun point n'est rattaché à `PV_CNM` : ce PV situe le DAO examiné, il n'a pas de point propre (l'écran le dira).

**À préserver** : l'ordre, la portée, l'obligation et le périmètre (catégorie, forme, sous-types exclus) des points ne changent pas ;
les examens en cours et les PV signés gardent leurs points et leurs résultats — le champ ne sert qu'au rangement à l'écran.

## Ce que fait le front

- À l'examen d'un dossier de marché, la grille de chaque onglet se lit sur `elements` (un point s'affiche sous chacun de ses
  éléments, son élément principal en premier) ; un onglet sans point le dit (« Aucun point propre ») au lieu d'afficher toute la grille.
  Tant que `elements` n'est pas servi, l'écran garde sa lecture actuelle par libellé.
- L'écran d'administration des points de contrôle propose le champ (cases à cocher dans l'ordre des onglets, principal désigné).

Hors périmètre, pour plus tard : la même notion pour l'examen d'un dossier de DAO (onglets Plan, Informations du DAO, Avis, Bordereau,
Canevas, Pièces).

> ⚠️ **2026-11-05 — B1 et B2 livrés (PRS20, V166) ; forme : colonne texte à virgules (`tr_points_ctrl.ELEMENTS`), servie en tableau.**
> - **B1** : `elements` est servi par toutes les lectures de points (dont `?sousType=`) et par `GET /api/dossiers/{id}/grille`, `[]`
>   quand le point n'en a pas (jamais `null` en sortie). Écriture : casse ignorée, doublons retirés, ordre gardé ; code inconnu → 400
>   nominatif `elements`. **Précision** : au `PUT`, un champ `elements` **absent conserve** la valeur (comme la portée, audit E3) ;
>   pour vider, envoyer `[]`.
> - **B2** : rattachement **par libellé** plutôt que par identifiant (les identifiants diffèrent entre recette, base de test et base
>   neuve) ; les 21 libellés de la recette (33-41, 101-109, 169-171) ont été rapprochés un à un, aucun écart. Idempotente : seul un point
>   sans élément est rattaché, un réglage de l'Administrateur n'est pas écrasé. Une base neuve reçoit le même rattachement par les
>   semeurs. Aucun point sur `PV_CNM`.
> - **Hors périmètre, constaté** : un point de même libellé dans une autre grille (MAOR notamment) n'est pas rattaché — la demande ne
>   porte que sur la grille MAOO ; à rattacher par l'administration, ou par une demande suivante.
## B3 — Seuls les éléments NOUVEAUX du dossier de marché portent des points (pilote, 05/11, après la livraison de V166)

Le pilote précise le principe : « la grille de contrôle doit s'appliquer aux éléments de dossiers qui n'ont pas encore passé en
examen, c'est-à-dire aux éléments nouveaux et caractéristiques du dossier ». Le **PV de la CNM**, les **informations du DAO** et le
**bordereau estimatif** ont été examinés au dossier de mise en concurrence : ils se lisent en référence, **sans point**. Les codes
`DAO` et `BORDEREAU` sortent donc du rattachement, comme `PV_CNM` (déjà absent).

- Retirer `DAO` et `BORDEREAU` des `elements` des points qui les portent (V166 les a posés en élément secondaire) :
  Délai de remise des offres → `SEANCE` · Rejets motivés par le DAO → `EVALUATION` · Montant évalué conforme au DAO → `EVALUATION` ·
  Offres anormales : processus et seuils → `EVALUATION` · Post-qualification sur les seuls critères du DAO → `EVALUATION` ·
  Qualification : activités et critères → `EVALUATION` · Spécifications techniques → `EVALUATION` · Moralité des prix → `EVALUATION` ·
  Offre retenue acceptable → `ATTRIBUTION`, `PRESENTATION`. Les autres points ne changent pas.
- La migration de V166 ne remplissant que les points sans élément, celle-ci **réécrit** ces neuf-là (par libellé, comme V166) — sauf
  si l'Administrateur les a déjà réglés autrement depuis (ne pas écraser un réglage) ; les semeurs d'une base neuve suivent.
- Au passage, si c'est simple : le même rattachement pour les grilles des autres sous-types du dossier de marché (MAOR…) aux libellés
  identiques (l'écart constaté dans votre encadré ci-dessus).

**Côté front (déjà fait)** : l'examen lit `elements` dès qu'il est servi ; un onglet `PV_CNM`, `DAO` ou `BORDEREAU` n'affiche aucun point
quoi que porte le référentiel, avec une note « Référence, déjà examinée » ; la grille s'ouvre sur la séance d'ouverture.
L'administration des points ne propose pas encore le champ (le formulaire générique ne saisit pas de liste) : sans risque, puisqu'un
`PUT` sans `elements` conserve le rattachement.

> ⚠️ **2026-11-05 — B3 livré (PRS20, V167), un écart mineur.**
> - Les neuf points sont réécrits aux valeurs cibles, par libellé, **seulement s'ils portent encore la valeur posée par V166** : un
>   réglage de l'Administrateur n'est pas écrasé. Les semeurs d'une base neuve posent directement les valeurs cibles.
> - **Autres sous-types DDM** : fait, simplement. Tout point DDM de même libellé encore sans élément, quel que soit son sous-type (MAOR…),
>   reçoit le même rattachement. **Constat en recette (lecture seule, 05/11)** : aucun point MAOR ne porte l'un des 21 libellés (9 communs,
>   12 MAOO), la grille MAOR ayant ses propres libellés. Rien n'y change donc, et ses 17 points restent sans élément : leur rattachement
>   demanderait une table validée par le pilote, comme celle de B2.
> - **Écart** : `DAO`, `BORDEREAU` et `PV_CNM` restent des codes **admis** à l'écriture : l'Administrateur peut encore les poser. Ce n'est
>   pas un refus, puisque l'écran n'affiche rien sous eux. Dites-nous s'il faut les refuser au `PUT`/`POST`.