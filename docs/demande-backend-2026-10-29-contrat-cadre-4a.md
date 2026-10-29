# Demande backend — 2026-10-29 — Contrat-cadre, tranche 4a : projet à un titulaire, notification de la reconduction, remises au calendrier

## Contexte

Tranche 4a du plan du 29/10 sur les trois formes de marché : ce qui manque au contrat-cadre **sans question de droit** à trancher
(les points A2 à A5 — quantité du besoin, remise sur plusieurs lots, contrat-cadre hors appel d'offres ouvert, hypothèses MS —
restent en attente de l'arbitrage du pilote et feront la tranche 4b).

## B1 — Le projet d'un contrat-cadre à **un seul** titulaire

`ProjetMarcheService.document` (l. 94-97) ne choisit le texte « PROJET DE CONTRAT-CADRE » (`contratCadre`, l. 187) que si la
proposition de la CAO nomme des **titulaires** (`in.titulaires()` non vide). Ce n'est le cas que d'un contrat-cadre
**multi-attributaire** (tranche MT-b1). Un contrat-cadre **mono-attributaire** reçoit donc le texte ordinaire « PROJET DE MARCHÉ » :
un marché à prix fermes pour la quantité du besoin, sans article sur les marchés subséquents, la remise en concurrence ou la
complétude de l'offre, sans durée de validité du contrat-cadre ni reconduction.

Même écart dans la clé `contratCadre` des modèles de document (`ProjetMarcheService.contexte`, l. 270 et 304 :
`cadre = titulaires non vide`), que lit la condition du modèle de départ (`ModelePvDepart`, l. 489). Un modèle de projet administré
par l'Administrateur ne peut donc pas non plus distinguer un contrat-cadre mono-attributaire.

Demandé :

- le texte du contrat-cadre se choisit sur la **forme de la fiche** (`TypeMarcheDao.CONTRAT_CADRE`, dernière version validée), et
  non sur le nombre de titulaires ;
- mono-attributaire : un seul titulaire, l'attributaire proposé ; l'article 4 dit, à la place des offres indicatives des titulaires,
  que les marchés subséquents sont attribués au titulaire **après complétude de son offre** (décret n° 2019-1064 ; le DPAC-CC le
  décrit déjà en mono-attributaire, l. 53) ;
- dans les deux cas : la **période de validité** (`B02-DC-02`), la **durée maximale** (`B02-DC-01` ou `B07-DU-05`), la
  **reconduction** (`B02-DC-03`, `B07-DU-04`) et le **préavis** (`B07-DU-07`), lus comme à la création du contrat en vigueur
  (`ContratVigueurService.creerALaNotification`, l. 118-140), pour que le projet et le contrat en vigueur disent la même chose ;
- la clé `contratCadre` des modèles vaut `oui` pour tout contrat-cadre, et une clé nouvelle `attributaires` (`MONO` / `MULTI`, la
  valeur du cadrage) permet au modèle de distinguer les deux.

Un projet déjà produit se refait par le geste existant (« Refaire », `AttributionService`, l. 1232-1268) tant que le marché n'est pas
signé : rien à migrer.

> ⚠️ **2026-10-29 — livré (PRS20), avec ces précisions.**
> - Sans fiche validée, le choix retombe sur les titulaires, comme avant.
> - **Mono-attributaire** : partie « et le titulaire suivant, ci-après « le Titulaire » » ; l'article 4 s'intitule « Offre du
>   Titulaire et prix des marchés subséquents » et donne son **offre initiale** (montant HT, délai), puis « À la survenance du
>   besoin, les marchés subséquents sont attribués au Titulaire après complétude de son offre initiale ». Pas d'article du décret
>   cité pour la complétude.
> - La durée et la reconduction forment un **article 5 « Durée et reconduction »** ; la notification devient l'article 6. La lecture
>   est la **même méthode** que celle du contrat en vigueur (`ContratVigueurService.TermesCadre`). Le préavis s'écrit « prise au
>   moins n mois avant la fin de la période en cours », omis s'il manque ; une autre donnée manquante s'écrit « …… ».
> - Modèles : `attributaires` vaut `MONO` / `MULTI` pour un contrat-cadre et **vide** hors contrat-cadre. Clé de plus,
>   **`reconductible`** (`oui` / `non` / `inconnue` sans fiche), et quatre variables : `MARCHE.CC_PERIODE`,
>   `MARCHE.CC_RECONDUCTIONS`, `MARCHE.CC_PREAVIS`, `MARCHE.CC_DUREE_MAX` (servies par `GET /variables?nature=PROJET_MARCHE`).
>   Un modèle de projet déjà enregistré par l'Administrateur garde son texte : seul le départ (`…/versions/depart`) est réécrit.

## B2 — La reconduction notifiée

`ContratVigueurService.reconduire` (l. 194-262) enregistre la décision de la PRMP (reconduire / ne pas reconduire, référence, date,
`horsPreavis`) et la trace dans le journal de l'attribution (`RECONDUCTION`, l. 257). **Aucune notification n'est émise.** L'alerte
`RECONDUCTION_A_DECIDER` (l. 334-335) reste une alerte **calculée à la lecture** : elle n'apparaît que dans l'écran du contrat et le
compteur de la PRMP, sans notification ni courriel.

Demandé :

- **à l'approche de la date limite de décision** (`dateLimiteDecision` − 30 jours, comme l'alerte) : une notification
  `RECONDUCTION_A_DECIDER` à la PRMP de la fiche (et à son UGPM), **une fois** par période, émise par la tâche planifiée existante
  (`AttributionScheduler`, toutes les heures) ;
- **à la décision** : une notification `CONTRAT_RECONDUIT` ou `CONTRAT_NON_RECONDUIT` à **chaque titulaire non retiré** (espace
  candidat, `TypeObjet.PROCEDURE`, comme `BON_COMMANDE`), avec la nouvelle date de fin, ou la date de fin du contrat s'il n'est pas
  reconduit ;
- **à l'échéance** (contrat `ECHU`) : une notification `CONTRAT_ECHU` à la PRMP et aux titulaires.

Les espaces externes lisent déjà leurs notifications (PRS20 51351b2) : le titulaire la verra dans sa cloche et son onglet
« Notifications ».

> ⚠️ **2026-10-29 — livré (PRS20, V147), avec ces précisions.**
> - Une fois par période : repère `RAPPEL_RECONDUCTION` = la `dateFin` rappelée. Une reconduction reporte `dateFin`, la période
>   suivante a donc son propre rappel.
> - Les titres nomment l'objet de la fiche, la procédure et le lot (« Reconduction à décider — « objet » (procédure n, lot n) »,
>   « Contrat-cadre reconduit — … », « Contrat-cadre non reconduit — … », « Contrat échu — … »).
> - **`CONTRAT_ECHU` vaut aussi pour le marché à commandes** (même table, même échéance) : « Le marché à commandes … est échu ».
> - **Rien n'est rejoué** : V147 marque comme notifiés les contrats déjà échus à son passage.

## B3 — Les remises en concurrence selon le calendrier

Quand le rythme des marchés subséquents est « Selon le calendrier fixé ci-après » (`B02-PC-02`), le calendrier est figé au contrat
(`ContratVigueur.calendrier` ← `B02-PC-03`, l. 132) et imprimé dans le DPAC-CC (l. 63) et l'AE-CC (l. 174 : « Cette remise en
concurrence interviendra selon la périodicité suivante : … »). Mais `B02-PC-03` est un **texte libre** : rien ne peut en déduire une
date, et aucune remise n'est jamais rappelée ni proposée à la PRMP.

Demandé :

- une forme **structurée** du calendrier, à côté du texte (qui reste celui imprimé) : périodicité en mois (1, 3, 6, 12…) et date de
  la première remise ; deux rubriques nouvelles du bloc B02 du référentiel, obligatoires quand `B02-PC-02` = « Selon le calendrier
  fixé ci-après », et figées au contrat en vigueur ;
- dans `ContratVigueurDto` : `prochaineRemise` (la prochaine échéance du calendrier, nulle sans calendrier structuré ou contrat échu) ;
- une alerte `REMISE_A_LANCER` (calculée comme les autres) à partir de 15 jours avant l'échéance, tant qu'aucune remise n'a été
  lancée depuis l'échéance précédente ;
- une notification `REMISE_A_LANCER` à la PRMP et à l'UGPM, une fois par échéance, par la tâche planifiée.

**La remise n'est jamais lancée par le serveur seul** : son objet, ses articles et sa date limite de réponse sont décidés par la
PRMP ou l'UGPM (`RemiseConcurrenceService`). Le serveur rappelle, il ne décide pas.

Pour les contrats en vigueur déjà créés avec un calendrier en texte libre : `prochaineRemise` reste nulle, sans alerte. Le dire
dans la documentation.

> ⚠️ **2026-10-29 — livré (PRS20, V147), avec trois écarts.**
> - **Les rubriques** : `B02-PC-04` (périodicité, mois, `NOMBRE`) et `B02-PC-05` (première remise, `DATE`), document maître
>   `AUCUN`. Elles sont **facultatives au référentiel** : la grammaire des conditions n'admet ni code de champ ni valeur à
>   espaces. L'obligation vit dans une règle bloquante du bilan, **`CALENDRIER_REMISES`** (bloc `B02`, champs
>   `B02-PC-02`, `-04`, `-05`), qui nomme ce qui manque. La copie du référentiel du contrat-cadre est recopiée dans
>   `docs/referentiel-champs-fiche-marche-contrat-cadre.csv` (non commitée). La base de recette est alignée par
>   `PRS20/docs/referentiel/2026-10-29-calendrier-remises-contrat-cadre.sql`.
> - **Le point de départ de « aucune remise lancée »** n'est pas l'échéance précédente mais l'**ouverture de la fenêtre** (J−15)
>   de l'échéance : une remise lancée en retard pour l'échéance précédente ne satisfait pas la suivante. Toute remise lancée compte
>   (remise en concurrence ou complétude).
> - **`prochaineRemise` peut être passée** : c'est l'échéance dont la fenêtre est ouverte et non satisfaite (remise en retard),
>   et l'alerte reste allumée jusqu'au lancement ; sinon l'échéance suivante. Nulle aussi quand plus aucune échéance ne tombe
>   avant `dateFin`.
>
> Le DTO gagne aussi **`periodiciteMois`** et **`premiereRemise`** (le calendrier figé), en fin d'objet. Notification une fois par
> échéance (repère `RAPPEL_REMISE`).

## Ce que fera le front

- **B1** : rien à construire (le projet se lit déjà) ; dans l'éditeur des modèles de projet, la clé `attributaires` rejoint la
  liste des variables (`features/admin/modeles-pv/`).
- **B2** : les libellés et les cibles des nouvelles notifications (cloche interne et espaces externes) ; la date limite de décision
  déjà affichée dans l'écran du contrat.
- **B3** : les deux champs du calendrier structuré dans la fiche marché (bloc B02, servis par le référentiel : la fiche suit sans
  livraison de son côté) ; la prochaine remise et l'alerte `REMISE_A_LANCER` dans l'écran des contrats en vigueur, avec le bouton
  « Lancer une remise » déjà existant.

Rien n'est construit avant la réponse.

> ⚠️ **Front, 2026-10-29 — livré** (sur PRS20 69aa66e, V147).
> - **B1** : rien à coder. L'éditeur des modèles lit ses variables au serveur (`GET /api/modeles-pv/variables`) : `attributaires`,
>   `reconductible` et les quatre `MARCHE.CC_*` y paraissent sans livraison du front.
> - **B2** : les cinq notifications d'un contrat (`RECONDUCTION_A_DECIDER`, `CONTRAT_RECONDUIT`, `CONTRAT_NON_RECONDUIT`,
>   `CONTRAT_ECHU`, `REMISE_A_LANCER`) mènent la PRMP et l'UGPM à l'écran des contrats en vigueur, **ce contrat ouvert**
>   (`/prmp/contrats-en-vigueur?dmc=<idDmc>`, `core/notifications/notification-route.ts`). Les titres sont ceux du serveur. Côté
>   titulaire (espace candidat), le repli existant ouvre la procédure (`/candidat/procedures/<idDmc>`).
> - **B3** : `ContratVigueur` gagne `periodiciteMois`, `premiereRemise`, `prochaineRemise`. L'écran du contrat affiche « Remises au
>   calendrier : tous les n mois, à partir du … », « Prochaine remise » (badge « En retard » si elle est passée) et l'alerte
>   « Remise en concurrence à lancer » ; le formulaire « Lancer une remise en concurrence… » est alors déplié d'office. Les
>   rubriques `B02-PC-04/05` et la règle `CALENDRIER_REMISES` de la fiche viennent du référentiel et du bilan : aucun code.
> - Non recetté à l'écran : aucun contrat en vigueur en base depuis le reset du 28/10.
