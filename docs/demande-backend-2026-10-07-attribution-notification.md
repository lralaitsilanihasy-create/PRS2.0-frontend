# Demande backend — 2026-10-07 — Évaluation des offres, lot 2 : de la proposition d'attribution à la notification

**Date** : 2026-10-07 · **Émetteur** : front · **Origine** : *Guide d'évaluation des offres* (07/10), section « De la proposition à la
notification », « Procédures infructueuses et déclaration sans suite » ; loi n° 2016-055 (art. 17, 20-I, 35-VII, 35-VIII, 52 à 56) ;
lot 1 livré et recetté (`demande-backend-2026-10-07-evaluation-des-offres.md`, V76-V78, front 7d241fa).

**Ce que le lot produit** : aujourd'hui, la procédure s'arrête au **rapport d'évaluation signé** (évaluation `CLOSE`), qui porte, par
lot, une **proposition d'attribution** ou une **infructuosité proposée** (`Lot.proposition`). Ce lot mène chaque lot jusqu'à son terme :

| Étape (guide, p. 7) | Acteur | Article | Ce que l'application fait |
|---|---|---|---|
| Examen par l'organe de contrôle | la Commission (CNM) | 17 | le **dossier de marché** (famille `DDM`) passe le circuit existant : réception, dispatch, examen, PV |
| Choix de l'attributaire | PRMP | 35-VII | sur l'avis de la CAO, puis l'avis favorable de la Commission |
| Information des candidats non retenus | PRMP | 52-I | lettres produites et envoyées, affichage, publication sur la procédure |
| Délai d'attente | — | 52-I | **10 jours francs** comptés par le serveur ; la signature est fermée avant |
| Demandes d'explication | candidats, PRMP | 52-II | question écrite du candidat, réponse écrite de la PRMP |
| Mise au point | PRMP, attributaire | 35-VIII | sans changer les caractéristiques substantielles ; rapport joint |
| Notification | PRMP | 54 | après enregistrement ; date d'effet du marché |
| Avis d'attribution | PRMP | 53 | publié sur la procédure, dans les 30 jours de la notification |
| Pièces fiscales et sociales | attributaire | 20-I | sous 15 jours de la notification de l'attribution ; à défaut, retrait du marché |
| Infructueux / sans suite | PRMP (et Commission pour le sans suite) | 55, 56 | décision motivée, notifiée à tous les candidats |

**Conventions** : les noms de routes, de champs, d'états et de codes sont **PROPOSÉS** ; le backend les fixe et corrige ce document
en place (encadré ⚠️ daté). Le front ne code rien contre un nom non confirmé. Les articles restent à valider sur les textes en vigueur
(Q9 du lot 1, au juriste).

**Le constat.**
- Le référentiel porte déjà la famille **`DDM` « Dossier de Marché »**, sous-types **`MAOO`** (appel d'offres ouvert) et **`MAOR`**
  (restreint), avec sept types de pièces : 14 « Projet de marché signé »*, 15 « Cahier des charges »*, 16 « Devis estimatif détaillé »*,
  17 « Procès-verbal d'ouverture des offres »*, 18 « Rapport d'analyse des offres »*, 19 « Attestation de capacité financière »,
  20 « Avis de non-objection (si requis) » (* obligatoires). **Aucun dossier `DDM` n'existe** en recette.
- **`GET /api/points-ctrls?sousType=MAOO` rend une grille vide** : la Commission n'aurait aucun point à examiner sur un dossier de
  marché (B2.3).
- Le dossier DAO se crée **depuis la fiche** (`POST /api/fiches-marche/{idDmc}/dossier`, pièces de la fiche jointes d'office) : le même
  geste est proposé ici, depuis l'évaluation.

---

## B1 — Le lot de la procédure et son état après le rapport

Une seule ressource par procédure et par lot, lue partout (fiche, évaluation, page de la procédure, espace du candidat) :

| Méthode | URL | Accès | Réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/attribution` | PRMP, UGPM, responsable, CAO (lecture) | `AttributionDto` |

- `AttributionDto` = `{ idDmc, lots[{ lot, etat, proposition (celle du rapport), attributaire?, dossierMarche?{ idDossier, etat, avis },
  information?, delaiAttente?{ debut, fin, ecoule }, explications[], miseAuPoint?, notification?, avisAttribution?, piecesAttributaire?,
  decisionInfructueux?, decisionSansSuite? }] }`.
- **États d'un lot** (proposés), dans l'ordre : `PROPOSE` (rapport signé) → `AU_CONTROLE` (dossier de marché soumis) → `AVIS_RENDU`
  (PV de la Commission signé) → `ATTRIBUE` (choix de la PRMP) → `INFORME` (non retenus informés, délai en cours) → `SIGNABLE` (délai
  écoulé) → `SIGNE` → `NOTIFIE` → `PUBLIE` (avis d'attribution). Et les issues : `INFRUCTUEUX`, `SANS_SUITE`, `RETIRE` (pièces fiscales
  et sociales non produites, B5).
- Chaque transition est tracée au journal de l'évaluation (même registre append-only), avec l'auteur, la date et le motif s'il y en a un.

> ⚠️ **Backend, 2026-10-07 — B1 livré en partie (tranche 2a, V79)** ; contrat : `docs/api-endpoints.md`, § *L'attribution, lot 2, tranche
> 2a*. Le lot 2 est livré par tranches : **2a** (B1, B2), **2b** (B3, B4.1, B4.2), **2c** (B4.3, B4.4, B5), **2d** (B6, Q3, B7).
> - `GET …/attribution` : accès CAO, responsable, PRMP, UGPM ; **404** tant que l'évaluation n'est pas ouverte. Dans cette tranche,
>   `AttributionDto` = `{idDmc, lots[{lot, etat, proposition, dossierMarche, projetDisponible}]}` ; les autres sections (attributaire,
>   information, délai…) s'ajoutent avec leurs tranches.
> - **États servis** : `PROPOSE`, `AU_CONTROLE`, `AVIS_RENDU`, et en plus **`EN_EVALUATION`** (évaluation ouverte, rapport pas encore
>   signé : `proposition` nulle). `AU_CONTROLE` dès la **création** du dossier de marché (pas sa soumission) ; `AVIS_RENDU` dès qu'un PV
>   du dossier est signé. Un lot proposé infructueux reste `PROPOSE`, avec `proposition.infructueux = true`.

## B2 — Le dossier de marché au contrôle de la Commission (art. 17)

### B2.1 Créer le dossier depuis l'évaluation

| Méthode | URL | Accès | Corps / réponse | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/dossier` | PRMP | → `Dossier` (famille `DDM`, sous-type `MAOO` ou `MAOR` selon le mode de la ligne) | 409 `EVALUATION_NON_CLOSE`, `LOT_INFRUCTUEUX`, `DOSSIER_EXISTANT` (avec `idDossier`) |

- **Pièces jointes d'office**, comme le DAO complet au dossier DAO :
  - 17 « Procès-verbal d'ouverture des offres » : le PV signé de la séance ;
  - 18 « Rapport d'analyse des offres » : le **rapport d'évaluation** signé (PDF) ;
  - 15 « Cahier des charges » : le **DAO complet** de la version validée ;
  - 16 « Devis estimatif détaillé » : le **bordereau des prix ou DQE rempli** de l'offre proposée (PDF des formulaires, lot 5) ; pour une
    offre déposée par pièces, la PRMP le joint.
- Restent à joindre par la PRMP : 14 « Projet de marché signé » (voir Q1), 19 et 20 selon le cas.
- **Un dossier par lot** (proposition) ; Q2 : un seul dossier pour plusieurs lots du même attributaire ?

> ⚠️ **Backend, 2026-10-07 — B2.1 livré (tranche 2a)**, avec ces écarts :
> - **`POST …/dossier` répond 201 avec l'`AttributionDto`** (pas le `Dossier`) : le lot porte `dossierMarche.idDossier`, d'où la page du
>   dossier s'ouvre. Accès : PRMP **et son UGPM**, comme le dossier DAO. 404 pour un lot inconnu.
> - **Q2 (arbitrage du pilote) : un dossier par lot.** **Q1 (arbitrage) : le projet de marché est produit par le serveur** et joint
>   d'office en pièce 14 (`PROJET_MARCHE`) : parties, objet, pièces constitutives, montant HT (prix corrigé − rabais) en chiffres et en
>   lettres, délai, entrée en vigueur, blocs de signature. C'est un document composé par le serveur, pas l'acte d'engagement officiel
>   rempli ; il est joint **non signé** (la signature du marché est un geste de la tranche 2c). Il se télécharge par
>   **`GET …/attribution/lots/{lot}/projet`** (`?format=docx` pour le Word).
> - Le dossier de marché **ne porte pas `idDmc`** : ce champ reste réservé au dossier DAO ; son lien est l'attribution du lot.
> - **Pièce 15** : le DAO complet s'il existe, **à défaut les documents séparés** de la version validée. **Pièce 16** : vide pour une
>   offre sans formulaires en ligne (la PRMP la joint). **Pièce 17** : le PV d'ouverture signé. **Pièce 18** : le rapport signé. Les
>   types sont repérés par un **code** posé par V79 (`PROJET_MARCHE`, `CAHIER_CHARGES`, `DEVIS_ESTIMATIF`, `PV_OUVERTURE`,
>   `RAPPORT_ANALYSE`). Ces pièces ne sont pas protégées contre la suppression (contrairement aux pièces produites par la fiche).

### B2.2 Le circuit

Le circuit existant, sans changement : soumission, recevabilité des pièces (Secrétaire), réception, dispatch, examen par le Membre,
PV et avis (`FAV`, `FAVR`, `DEF`), signatures. **L'avis rendu** remonte au lot (`dossierMarche.avis`) ; un avis défavorable laisse le lot
`AVIS_RENDU` sans attribution possible (Q3 : que fait la PRMP alors — reprise de l'évaluation, infructuosité ?).

### B2.3 La grille d'examen du dossier de marché

Le sous-type `MAOO` n'a aucun point de contrôle. Proposition, tirée de la check-list du guide (p. 8), en points **spécifiques** à
`MAOO` / `MAOR` (référentiel des points de contrôle par sous-type, administrable) :
- la CAO a été désignée par décision, et ses membres ont signé une déclaration d'absence de conflit d'intérêts ;
- le PV d'ouverture est signé et publié ; les plis hors délai ont été écartés sans ouverture ;
- chaque rejet est motivé par une clause du DAO ;
- les erreurs arithmétiques sont corrigées selon les IC ; le montant évalué inclut rabais, préférence et critères du DAO, et eux seuls ;
- aucune offre anormalement basse n'a été rejetée sans demande écrite de justification ;
- le classement suit le montant évalué croissant ; l'attributaire proposé est le mieux classé qualifié ;
- la post-qualification n'a retenu que les critères du DAO ;
- le rapport est signé de tous les membres (observations de désaccord comprises) ;
- le projet de marché reprend l'offre retenue sans modification substantielle.

Le backend les sème en migration ; l'Administrateur peut les modifier ensuite.

> ⚠️ **Backend, 2026-10-07 — B2.2 et B2.3 livrés (tranche 2a)**, avec ces écarts :
> - **B2.3** : les neuf points sont **communs à la famille `DDM`** (donc à `MAOO` et `MAOR`), pas spécifiques à chaque sous-type :
>   une seule ligne par point à administrer, comme les points FICHE du plan. Ils sont **semés au démarrage** (pas en migration : la
>   table des points porte des clés étrangères vers des référentiels que les migrations ne posent pas), là où la famille `DDM` existe ;
>   un point modifié par l'Administrateur n'est jamais réécrit.
> - **B2.2** : l'avis remonte au lot (`dossierMarche.avis`) dès qu'un PV du dossier est signé. **Q3 (arbitrage du pilote)** : après un
>   avis défavorable, la PRMP choisira, avec un motif, entre la **reprise de l'évaluation** et l'**infructuosité** — livré en tranche 2d.

## B3 — Le choix de l'attributaire (art. 35-VII)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/attribuer` | PRMP | `{ idOffre, motif? }` | 409 `AVIS_NON_RENDU`, `AVIS_DEFAVORABLE`, `LOT_INFRUCTUEUX` ; 400 `MOTIF_OBLIGATOIRE` |

- Par défaut, l'offre **proposée par la CAO** ; une autre offre (classée et qualifiée) exige un **motif** (Q4 : la PRMP peut-elle
  s'écarter de l'avis de la CAO, et dans quels cas ?).

## B4 — Information des non retenus, délai d'attente, explications, signature, notification, avis d'attribution

### B4.1 L'information (art. 52-I)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/informer` | PRMP | `{ dateAffichage }` | 409 `NON_ATTRIBUE`, `DEJA_INFORME` |
| GET | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/lettres/{idOffre}` | PRMP, UGPM | la lettre (PDF, Word) | 404 |
| GET | `/api/candidat/offres/{idOffre}/resultat` | candidat de l'offre | `{ retenu, motifRejet?, attributaire, montant, caracteristiques, lettre (lien), dateInformation, finDelai }` | 404 avant l'information |

- **Une lettre par candidat non retenu**, produite par le serveur : rejet, **motifs** (ceux du rapport : étape, motif, clause), nom de
  l'attributaire, montant et caractéristiques de l'offre retenue. Notification et courriel au candidat (« tout moyen de preuve » :
  l'accusé de lecture de la plateforme et la date d'envoi du courriel sont gardés). L'attributaire reçoit sa lettre d'attribution.
- **Affichage au siège** : la date est déclarée par la PRMP ; la page publique de la procédure porte l'information (attributaire,
  montant).
- **Le délai d'attente** : au moins **10 jours francs** entre l'information et la signature, calculé par le serveur (jours francs : ni le
  jour de l'information, ni celui de l'échéance) ; `delaiAttente.fin` servi ; la signature est refusée avant (409 `DELAI_ATTENTE`).

### B4.2 Les demandes d'explication (art. 52-II)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/candidat/offres/{idOffre}/explication` | candidat non retenu | `{ question }` | 409 `NON_INFORME` |
| POST | `/api/fiches-marche/{idDmc}/attribution/explications/{id}/reponse` | PRMP | multipart `{ texte }` + `fichier?` | 409 `DEJA_REPONDU` |

- Sur le modèle des demandes du lot 1 (sens inverse). Un **recours** auprès de l'ARMP (art. 19) se fait hors de l'application ; Q5 :
  la PRMP doit-elle pouvoir **déclarer un recours** reçu, qui suspend la signature ?

### B4.3 Mise au point, signature, notification

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/mise-au-point` | PRMP | multipart `{ rapport }` + `fichier?` (rapport de mise au point) | 409 `NON_ATTRIBUE` |
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/signature` | PRMP | multipart `{ dateSignature, dateEnregistrement? }` + `fichier` (marché signé) | 409 `DELAI_ATTENTE`, `RECOURS_EN_COURS` |
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/notification` | PRMP | `{ dateNotification }` | 409 `NON_SIGNE`, `NON_ENREGISTRE` (Q6) |

- La mise au point ne remet pas en cause les caractéristiques substantielles, financières notamment (art. 35-VIII) : le serveur ne le
  contrôle pas ; le rapport est joint au dossier.
- La notification ouvre l'exécution : le marché prend effet à la **réception** par l'attributaire (date d'accusé de la plateforme,
  ou date déclarée).

### B4.4 L'avis d'attribution (art. 53)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/avis` | PRMP | `{ datePublication }` → l'avis (PDF, Word), publié sur la page de la procédure | 409 `NON_NOTIFIE` |

- **Échéance : 30 jours** après la notification ; le serveur la sert (`avisAttribution.echeance`) et alerte la PRMP à l'approche.
- Modèle d'avis : celui de l'ARMP, s'il existe (Q7) ; sinon un modèle proposé, sur le modèle de l'avis spécifique.

## B5 — Les pièces fiscales et sociales de l'attributaire (art. 20-I)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/candidat/offres/{idOffre}/pieces-attributaire` | attributaire | multipart `type` (`FISCALE` \| `SOCIALE`), `dateDelivrance`, `fichier` | 409 `NON_ATTRIBUTAIRE`, `DELAI_DEPASSE` |
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/pieces/{id}/verifier` | PRMP | `{ conforme, motif? }` | |
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/retirer` | PRMP | `{ motif }` | 409 `DELAI_EN_COURS` |

- Situation fiscale régulière de **moins de six mois**, situation sociale de **moins de trois mois** (contrôle des dates par le
  serveur), à produire **dans les 15 jours** suivant la notification de l'attribution.
- À défaut : la PRMP **retire** le marché ; Q8 : la réattribution reprend-elle la post-qualification au candidat suivant (lot 1, étape 5
  rouverte), avec un nouveau dossier de marché ?

## B6 — Procédure infructueuse (art. 56) et déclaration sans suite (art. 55)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/infructueux` | PRMP | `{ motif, decision{ reference, date }, suite? (RELANCE \| RESTREINTE \| NEGOCIEE) }` | 409 `EVALUATION_NON_CLOSE` |
| POST | `/api/fiches-marche/{idDmc}/sans-suite` | PRMP | `{ motifs }` → demande d'avis à l'organe de contrôle | 409 `MARCHE_SIGNE` |
| POST | `/api/fiches-marche/{idDmc}/sans-suite/avis` | Président de la Commission (Q10) | `{ favorable, motif }` | 409 `DELAI_DEPASSE` |

- **Infructueux** : sur décision formelle de la PRMP, pour un lot proposé infructueux par le rapport, ou sans offre conforme ; notifié
  à tous les candidats du lot, affiché ; la suite (relance, procédure restreinte, négociée) est **déclarée**, pas conduite ici.
- **Sans suite** : à tout moment avant la signature (409 `MARCHE_SIGNE` après), pour motif d'intérêt général. Les motifs vont à
  l'organe de contrôle, qui se prononce **sous 5 jours** ; un refus oblige à reprendre la procédure. La décision est affichée et
  notifiée à tous les candidats avec ses motifs ; l'attributaire n'a droit ni à la signature ni à une indemnité.

## B7 — Accès, notifications, journal, compteurs

- **Accès** : la PRMP agit ; l'UGPM et le responsable lisent ; les membres de la CAO lisent l'état de leurs lots ; le candidat ne voit
  que **son** résultat, ses lettres, ses explications et, attributaire, ses pièces.
- **Notifications** (proposées) : `RESULTAT_DISPONIBLE` (candidats, et courriel), `ATTRIBUTION` (attributaire), `EXPLICATION_DEMANDEE`
  et `EXPLICATION_REPONDUE`, `DELAI_ATTENTE_ECOULE` (PRMP), `PIECES_ATTRIBUTAIRE_DEPOSEES` (PRMP), `ECHEANCE_AVIS_ATTRIBUTION` (PRMP,
  à J-5), `PROCEDURE_INFRUCTUEUSE`, `PROCEDURE_SANS_SUITE` (candidats).
- **Compteurs** (`/api/kpis/badges`, PRMP) : lots à attribuer (avis rendu), lots signables (délai écoulé), avis d'attribution à publier,
  explications sans réponse.

## Hypothèses (à confirmer ou corriger)

- **H1** — Comme au lot 1, seules les procédures en **remise électronique** sont concernées.
- **H2** — Le contrôle de la Commission porte sur **chaque** marché issu d'une procédure en ligne. *Les seuils de l'art. 17 (contrôle a
  priori ou a posteriori) sont-ils à appliquer ici — et alors, d'où viennent-ils ? — voir Q11.*
- **H3** — Les documents produits (lettres, avis d'attribution) suivent le modèle des documents du DAO : Word et PDF, gabarit
  administrable.

## Questions

| # | Question | À qui |
|---|---|---|
| Q1 | Le « projet de marché signé » (pièce 14) : signé par qui avant le contrôle de la Commission — l'attributaire seul ? Le serveur peut-il le **produire** (acte d'engagement et CCAP de l'offre retenue) ? | pilote |
| Q2 | Un dossier de marché par lot, ou un par attributaire quand il remporte plusieurs lots ? | pilote |
| Q3 | Après un avis défavorable de la Commission sur le marché : reprise de l'évaluation (étape à rouvrir), infructuosité, autre ? | pilote, juriste |
| Q4 | La PRMP peut-elle attribuer à une autre offre que celle proposée par la CAO ? Dans quels cas ? | juriste |
| Q5 | Un recours reçu (ARMP) doit-il être déclaré dans l'application et suspendre la signature ? | pilote, juriste |
| Q6 | L'enregistrement du marché (art. 54) : une date à déclarer, avec une pièce ? | pilote |
| Q7 | Le modèle d'avis d'attribution et celui de la lettre aux non retenus : existe-t-il des modèles ARMP à reprendre ? | pilote |
| Q8 | Retrait du marché faute de pièces fiscales et sociales : réattribution au suivant (post-qualification rouverte) ? | pilote, juriste |
| Q9 | Les lettres et avis sont-ils signés électroniquement par la PRMP, ou imprimés et signés à la main ? | pilote |
| Q10 | L'avis de l'organe de contrôle sur une déclaration sans suite : rendu par le Président de la Commission, ou par un circuit de dossier ? | pilote |
| Q11 | Les seuils de contrôle a priori / a posteriori de l'art. 17 : à appliquer, et sur quel montant (évalué, TTC lu) ? | juriste |

> ⚠️ **Backend, 2026-10-07 — arbitrages du pilote du même jour** : **Q1** le projet de marché est **produit par le serveur** ; **Q2** **un
> dossier par lot** ; **Q3** après un avis défavorable, la PRMP choisit, avec un motif, entre reprise de l'évaluation et infructuosité
> (tranche 2d) ; **Q11** **chaque marché en ligne** passe au contrôle, sans seuil (H2 retenue). **H1** retenue (remise électronique
> seule). Q4 à Q10 restent ouvertes ; elles seront posées avec les tranches qui en dépendent.

## Ce que le front fera, et quand

- **Dès B1-B2** : sur l'écran d'évaluation close, une section « Attribution » par lot : la proposition, « Créer le dossier de marché »,
  le suivi du dossier et de l'avis de la Commission ; la page du dossier de marché comme celle du dossier DAO.
- **Dès B3-B4** : le choix de l'attributaire, l'information des candidats (lettres, date d'affichage), le compte à rebours du délai
  d'attente, les explications, la mise au point, la signature, la notification et l'avis d'attribution ; côté candidat, le résultat
  et les lettres sur « Mes offres », la demande d'explication.
- **Dès B5-B6** : le dépôt des pièces fiscales et sociales par l'attributaire et leur vérification ; les décisions d'infructuosité et
  de sans suite.

> ✅ **Front, 2026-10-07 — tranche 2a livrée.** Sous l'évaluation close, la section « Attribution » (`features/evaluation/attribution-lots.ts`) :
> par lot, l'état, la proposition du rapport (ou l'infructuosité proposée), « Créer le dossier de marché » (PRMP et UGPM ; 409 nommés,
> `DOSSIER_EXISTANT` avec son numéro), le dossier (n°, sous-type, statut, avis de la Commission), « Ouvrir le dossier de marché » (page
> du dossier PRMP), le projet de marché en PDF et Word. Les membres de la CAO et le responsable lisent.
>
> ✅ **Recette du 2026-10-07 (fiche 40)** : dossier de marché **100371** créé pour le lot 1 (`MAOO`, brouillon ; lot `AU_CONTROLE`) ; le
> lot 2, proposé infructueux, n'en a pas. Projet de marché lu (1 page, conforme au contrat).
>
> **Constats pour le backend :**
> - **D1** — **la pièce 17 « Procès-verbal d'ouverture des offres » n'est pas jointe** au dossier 100371, alors que la séance de la fiche 40
>   est `CLOSE` et son PV signé. Pièces jointes d'office : 14 (projet), 15 (DAO complet), 18 (rapport). La 16 manque à bon droit (offre n° 4
>   déposée sans formulaires).
>   ⚠️ *Précision du même jour* : sur la **fiche 44**, le dossier de marché **100372** porte bien la pièce 17 (`pv-ouverture_44.pdf`). Le
>   défaut tient donc à la fiche 40 : son PV d'ouverture est peut-être antérieur au stockage du PV signé (séance du 04/10, avant V70) ;
>   à confirmer, et à rattraper si c'est le cas.
> - **D2** — le projet de marché, article 4, écrit « Le délai d'exécution est celui de l'acte d'engagement : 6. » — sans unité, comme le
>   constat C2 du rapport d'évaluation (`delaiUnite`).

> ⚠️ **Front, 2026-10-07 — arbitrages du pilote pour la tranche 2b** :
> - **Q4** : **non, jamais**. La PRMP attribue à l'offre **proposée par la CAO** ; `attribuer` n'accepte pas d'autre offre (proposition :
>   409 `OFFRE_NON_PROPOSEE`, et `idOffre` peut être omis). En désaccord, la PRMP ne peut que déclarer le lot infructueux ou la procédure
>   sans suite, avec un motif (tranche 2d).
> - **Q7** : **le pilote fournira les modèles officiels** (lettre aux candidats non retenus, lettre d'attribution, avis d'attribution) en
>   Word dans le dépôt ; en attendant, le serveur produit un modèle provisoire, remplacé à leur arrivée.
> - **Q9** : **signature électronique simple** de la PRMP, horodatée et journalisée, imprimée sur la lettre et l'avis, comme pour le PV
>   d'ouverture ; envoi en ligne et par courriel.

> ⚠️ **Front, 2026-10-07 — arbitrages du pilote sur Q5, Q6, Q8 et Q10** (avec ce que la loi tranche et ce qui reste à vérifier) :
>
> - **Q5 — recours auprès de l'ARMP** (art. 18, 19, 52-I). **Déclaré dans l'application, il bloque la signature** jusqu'à la décision du
>   Comité de Règlement des Différends : le délai d'attente de l'art. 52 sert précisément aux recours. Proposition de contrat (tranche 2c) :
>   `POST …/lots/{lot}/recours` (PRMP) `{ dateReception, requerant, objet }` + pièce ; `POST …/recours/{id}/decision` `{ date, issue
>   (REJETE | ACCUEILLI | AUTRE), motif }` + pièce ; la signature répond 409 **`RECOURS_EN_COURS`** tant qu'un recours n'a pas sa décision.
>   *À vérifier au titre VIII* : l'effet suspensif et ses délais ; si un délai fait tomber le blocage, il s'ajoutera en paramètre.
> - **Q6 — enregistrement du marché** (art. 54). L'enregistrement est un **préalable obligatoire** à la notification. Une **date** et une
>   **pièce justificative** (quittance ou référence d'enregistrement) suffisent ; **aucune notification sans enregistrement déclaré**
>   (409 `NON_ENREGISTRE`). Les droits et le service compétent relèvent de la législation fiscale : l'application ne les calcule pas.
> - **Q8 — pièces fiscales et sociales non fournies** (art. 20-I, 47, 52, 56). Retrait du marché, puis **réattribution au candidat suivant**
>   du classement, à trois conditions : sa **post-qualification** (l'étape 5 du lot rouverte au suivant), une **offre encore valide** (délai
>   de validité non échu), et une **nouvelle information** des candidats avec un **nouveau délai de 10 jours francs**. S'il ne reste aucun
>   candidat éligible : **infructuosité** (art. 56). Le contrôle de la Commission sur le nouveau dossier de marché : *à préciser par le
>   backend* (proposition : un nouveau dossier `DDM`, comme pour le premier attributaire).
> - **Q10 — avis sur une déclaration sans suite** (art. 55-II). L'avis est rendu par **l'organe de contrôle, et non par une personne** :
>   **un dossier dans le circuit** de la Commission, au lieu du `POST …/sans-suite/avis` proposé en §B6. Proposition :
>   - un sous-type de dossier propre (par exemple « Déclaration sans suite », famille à fixer par le backend), créé par
>     `POST …/sans-suite` avec les motifs de la PRMP en pièce ;
>   - une **échéance de 5 jours** affichée et suivie (alerte à la Commission et à la PRMP) ;
>   - **deux issues seulement** : favorable ou défavorable (pas de `FAVR`) ;
>   - avis **défavorable** : la procédure **reprend son cours** automatiquement ; avis **favorable** : la PRMP déclare le sans suite,
>     affiché et notifié à tous les candidats ;
>   - une **signature paramétrable** (Président seul, délégation, ou examen collégial), pour suivre la règle interne de la Commission ;
>     *à vérifier* : le décret d'organisation de la CNM/CRM.

> ⚠️ **Front, 2026-10-07 — vérification sur le texte de la loi n° 2016-055** (version CNLEGIS, 60 pages, fournie par le pilote). Elle
> **corrige** trois points ci-dessus et en soulève un quatrième :
>
> 1. **Le point de départ du délai de 10 jours francs (B4.1)** — art. 78 : la signature ne peut intervenir avant dix jours francs
>    décomptés à partir de **la plus tardive** de deux dates : l'information des candidats du rejet de leur offre, et l'**affichage du
>    résultat** au siège de l'autorité contractante. Le serveur compte donc depuis `max(dateInformation, dateAffichage)`, pas depuis
>    l'information seule. L'information se fait « par lettre recommandée avec accusé de réception ou par tout autre moyen permettant
>    d'établir avec certitude la preuve de la réception » (art. 52-I) : l'accusé de lecture de la plateforme doit être gardé.
> 2. **Les recours (Q5)** — le titre VIII en distingue trois, aux effets différents :
>    - **demande de réexamen** auprès de la PRMP (recours gracieux, art. 79) : la PRMP répond **sous 10 jours** ; **non suspensif** ;
>    - **demande en révision** auprès de l'ARMP (art. 80) : le Directeur général enjoint de **suspendre la procédure** jusqu'à la décision,
>      **pour 20 jours au plus** ; décision sous **10 jours ouvrables** ;
>    - **référé précontractuel** devant la juridiction administrative (art. 78) : le juge peut faire **différer la signature**, **20 jours
>      au plus**.
>    Le contrat proposé devient : `recours.type` ∈ `REEXAMEN` | `REVISION_ARMP` | `REFERE` ; la signature est refusée (409
>    `RECOURS_EN_COURS`) pour une révision ou un référé, jusqu'à la décision ou au terme des 20 jours de suspension ; un réexamen ne
>    bloque pas, mais son échéance de réponse (10 jours) est suivie et alertée.
> 3. **L'infructuosité (Q3, Q8, B6)** — art. 56 : elle se déclare « après **avis conforme de la Commission d'appel d'offres** » (le rapport
>    signé le porte), dans des cas limités (aucune offre ; toutes inacceptables, inappropriées ou non conformes ; une seule offre en appel
>    d'offres restreint ; cas propres aux prestations intellectuelles, art. 56-II), et **« ne doit en aucun cas intervenir après la décision
>    d'attribution »** (art. 56-VI). **Conséquence pour Q8** : après un retrait faute de pièces fiscales et sociales, si aucun candidat
>    suivant n'est éligible, l'infructuosité **n'est pas possible** (l'attribution a eu lieu) ; la sortie reste à trancher par le juriste
>    (nouvelle procédure ? sans suite, possible tant que le marché n'est pas signé, art. 55-II ?). Le backend ne doit pas proposer
>    l'infructuosité dans ce cas.
> 4. **Pour le juriste (lot 1)** — l'art. 46 confie l'établissement de la conformité et la rectification des erreurs de calcul à la
>    **PRMP**, et l'art. 48 lui confie le **rejet** d'une offre anormale ; l'art. 47-II confie le **montant évalué** à la **CAO**. Le lot 1 fait
>    décider la CAO à chaque étape (arbitrage du pilote, Q1). À confirmer : la décision de la CAO vaut-elle proposition à la PRMP, qui
>    l'entérinerait, ou la pratique (art. 12, CAO) suffit-elle ?
>
> Confirmés tels que consignés : art. 20-I (pièces datées à la notification de l'attribution, 15 jours, retrait en vue d'une
> réattribution), art. 52-II (explications écrites), art. 53 (avis d'attribution sous 30 jours ; ses mentions sont fixées par **arrêté du
> Ministre des Finances**, à reprendre dans le modèle), art. 54 (enregistrement préalable ; notification par tout moyen donnant date
> certaine, effet à la réception), art. 55 (organe de contrôle, 5 jours, jamais après la signature), art. 49 (préférence plafonnée à
> 15 % ou 10 %, seulement si le DAO la prévoit).
