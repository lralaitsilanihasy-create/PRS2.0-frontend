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

> ⚠️ **Backend, 2026-10-07 — B3 livré (tranche 2b, V80)** ; contrat : `docs/api-endpoints.md`, § *L'attribution, lot 2, tranche 2b*.
> - **Q4 appliqué** : `idOffre` est **facultatif** ; une offre autre que la proposée répond 409 **`OFFRE_NON_PROPOSEE`**. `motif` reste
>   accepté, facultatif, et ne sert plus qu'au journal.
> - Codes : 409 `LOT_INFRUCTUEUX`, `AVIS_NON_RENDU`, `AVIS_DEFAVORABLE` comme proposés, plus **`DEJA_ATTRIBUE`**. Pas de 400
>   `MOTIF_OBLIGATOIRE` (sans objet depuis Q4). L'avis `FAVR` (favorable avec réserves) ouvre l'attribution comme `FAV`.
> - Accès : la **PRMP seule** (403 pour l'UGPM), comme tout geste qui engage. Réponse : l'`AttributionDto` ; le lot passe `ATTRIBUE`
>   et porte `attributaire{ idOffre, numero, candidat, nif, montant, montantTtc, delai, motif, le, par }`, montants et délai **figés au
>   choix**.

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

> ⚠️ **Backend, 2026-10-07 — B4.1 livré (tranche 2b, V80)**, avec ces écarts et précisions :
> - **`informer`** : la PRMP seule ; `dateAffichage` obligatoire (400 `DATE_AFFICHAGE_OBLIGATOIRE`), comprise entre la date de
>   l'attribution et le jour même (400 `DATE_AFFICHAGE_INVALIDE`) ; 409 `NON_ATTRIBUE`, `DEJA_INFORME`. Réponse : l'`AttributionDto`.
> - **Le délai suit l'art. 78** (correction du pilote) : `delaiAttente` = `{ debut, fin, signableLe, jours, ecoule }`, où `debut` est la
>   **plus tardive** de l'information et de l'affichage, `fin` le dixième jour franc, et **`signableLe`** (en plus) le lendemain, premier
>   jour où la signature est possible. Le lot passe `INFORME`, puis **`SIGNABLE`** quand `ecoule`. Pas de report d'une échéance tombant
>   un week-end ou un jour férié : à confirmer par le juriste.
> - **Les lettres** : une par **offre évaluée** du lot, en PDF et Word, signées électroniquement par la PRMP (Q9 : son nom et
>   l'horodatage imprimés, journal `INFORMATION`), sur un **modèle provisoire** (Q7). Les motifs viennent du rapport : l'étape qui a
>   écarté l'offre, sa qualification, son motif, sa clause ; sinon son rang. Les offres **non ouvertes** en séance (hors délai, retirées,
>   remplacées) n'ont pas de lettre. `information` = `{ le, par, signataire, dateAffichage, lettres[{ id, idOffre, numero, candidat, type
>   (ATTRIBUTION | NON_RETENU), motif, envoyeeLe, lueLe }] }`.
> - **La preuve de réception** : `envoyeeLe` = la date d'envoi du courriel (nulle sans adresse) ; `lueLe` = **l'accusé de lecture de la
>   plateforme**, posé à la première consultation du résultat ou de la lettre par le candidat (journal `LETTRE_LUE`).
> - **La lettre** : `GET …/lots/{lot}/lettres/{idOffre}` (`?format=docx` pour le Word). Lecteurs : CAO, responsable, PRMP, UGPM.
> - **Le résultat du candidat** : `GET /api/candidat/offres/{idOffre}/resultat` → `{ idOffre, numero, lot, retenu, motifRejet,
>   attributaire, montant, montantTtc, delai, lettreDisponible, dateInformation, dateAffichage, finDelai, signableLe }`. Les
>   caractéristiques de l'offre retenue sont `montant` (HT), `montantTtc` (prix lu) et `delai`. Le **lien de la lettre** devient une route :
>   `GET /api/candidat/offres/{idOffre}/resultat/lettre` (`?format=docx`). 404 avant l'information ; 403 pour l'offre d'un autre.
> - **La page publique** : `GET /api/procedures-en-ligne/{idDmc}/resultats` (sans session) → `[{ lot, attributaire, montant,
>   dateInformation, dateAffichage }]`, vide avant l'information.
> - **Notifications** : `ATTRIBUTION` (attributaire) et `RESULTAT_DISPONIBLE` (autres candidats), avec courriel.

### B4.2 Les demandes d'explication (art. 52-II)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/candidat/offres/{idOffre}/explication` | candidat non retenu | `{ question }` | 409 `NON_INFORME` |
| POST | `/api/fiches-marche/{idDmc}/attribution/explications/{id}/reponse` | PRMP | multipart `{ texte }` + `fichier?` | 409 `DEJA_REPONDU` |

- Sur le modèle des demandes du lot 1 (sens inverse). Un **recours** auprès de l'ARMP (art. 19) se fait hors de l'application ; Q5 :
  la PRMP doit-elle pouvoir **déclarer un recours** reçu, qui suspend la signature ?

> ⚠️ **Backend, 2026-10-07 — B4.2 livré (tranche 2b, V80)** :
> - `POST /api/candidat/offres/{idOffre}/explication` `{ question }` → **201** avec l'`Explication` ; 400 `QUESTION_OBLIGATOIRE` ; 409
>   `NON_INFORME`, et **`OFFRE_RETENUE`** (en plus) pour l'attributaire.
> - En plus, côté candidat : `GET /api/candidat/offres/{idOffre}/explications` (ses demandes et les réponses) et
>   `GET …/explications/{id}/fichier` (le fichier joint à la réponse).
> - `POST /api/fiches-marche/{idDmc}/attribution/explications/{id}/reponse` (multipart `texte` + `fichier` facultatif : PDF, JPEG ou PNG)
>   → l'`Explication` ; 400 `TEXTE_OBLIGATOIRE`, `FORMAT_INVALIDE` ; 409 `DEJA_REPONDU` ; PRMP seule. Le fichier se relit par
>   `GET …/attribution/explications/{id}/fichier` (CAO, responsable, PRMP, UGPM).
> - Les demandes du lot sont servies dans `lots[].explications[]` = `{ id, idOffre, numero, candidat, question, demandeeLe, etat
>   (EN_ATTENTE | REPONDUE), reponse, reponseNom, reponseTaille, reponduLe }`. Aucun délai imposé.
> - Notifications `EXPLICATION_DEMANDEE` (PRMP) et `EXPLICATION_REPONDUE` (candidat, avec courriel). Les recours (Q5) suivent en
>   tranche 2c.

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

> ⚠️ **Backend, 2026-10-07 — B4.3 et les recours (Q5) livrés (tranche 2c, V81)** ; contrat : `docs/api-endpoints.md`, § *L'attribution,
> lot 2, tranche 2c*. Tous les gestes : PRMP seule (403 pour l'UGPM), réponse = l'`AttributionDto` à jour.
> - **Mise au point** : comme proposée ; 400 `RAPPORT_OBLIGATOIRE` ; 409 `NON_ATTRIBUE`, plus `DEJA_SIGNE` et `LOT_RETIRE`. Refaite avant
>   la signature, elle remplace le rapport. Servie dans `lots[].miseAuPoint` = `{ rapport, le, par, fichier }` ; tout fichier de
>   l'attribution = `{ id, nature, nom, format, taille, deposeLe }`, téléchargé par **`GET …/attribution/pieces/{id}/fichier`**.
>   Le rapport n'est pas joint au dossier de marché (déjà examiné par la Commission) : il reste sur l'attribution.
> - **Écart : l'enregistrement est un geste à part** (Q6 : une date **et** une pièce) : `POST …/lots/{lot}/enregistrement` multipart
>   `dateEnregistrement`, `reference?`, `fichier` (obligatoire) ; 409 `NON_SIGNE`, `DEJA_ENREGISTRE`. `signature` ne prend donc plus
>   `dateEnregistrement`.
> - **Signature** : multipart `dateSignature` + `fichier` (obligatoire, 400 `FICHIER_OBLIGATOIRE`) ; 400 `DATE_INVALIDE` (date à venir) ;
>   409 `DELAI_ATTENTE` (avant `delaiAttente.signableLe`), `RECOURS_EN_COURS`, et en plus `NON_INFORME`, `DEJA_SIGNE`, `LOT_RETIRE`, et
>   **`PIECES_NON_CONFORMES`** — voir §B5 : la signature attend les deux pièces de l'attributaire reconnues conformes.
> - **Notification** : `{ dateNotification, dateReception? }` ; 409 `NON_SIGNE`, `NON_ENREGISTRE`, `DEJA_NOTIFIE`. La **réception** (date
>   d'effet) : `dateReception` déclarée par la PRMP, sinon l'**accusé de lecture** de la plateforme, posé à la première consultation par
>   l'attributaire de son résultat ou de **`GET /api/candidat/offres/{idOffre}/marche`** (le marché signé, nouveau). Servie dans
>   `lots[].notification` = `{ date, le, par, recueLe, receptionDeclaree }`. Notification `MARCHE_NOTIFIE` avec courriel.
> - **Recours (Q5, après la lecture de la loi)** : `POST …/lots/{lot}/recours` multipart `type` (`REEXAMEN` | `REVISION_ARMP` | `REFERE`),
>   `dateReception`, `requerant`, `objet`, `fichier?` ; `POST …/recours/{id}/decision` multipart `date`, `issue` (`REJETE` | `ACCUEILLI` |
>   `AUTRE`), `motif`, `fichier?` (409 `DEJA_DECIDE`). Servis dans `lots[].recours[]` avec `suspensif`, **`finSuspension`** (réception +
>   20 jours, révision et référé), **`echeanceReponse`** (réception + 10 jours, réexamen) et **`bloquant`** (la signature est fermée
>   aujourd'hui). Passé `finSuspension` sans décision, le recours ne bloque plus. Un recours accueilli n'a pas d'effet automatique.
> - Les états **`SIGNE`** et **`NOTIFIE`** s'ajoutent.

### B4.4 L'avis d'attribution (art. 53)

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/attribution/lots/{lot}/avis` | PRMP | `{ datePublication }` → l'avis (PDF, Word), publié sur la page de la procédure | 409 `NON_NOTIFIE` |

- **Échéance : 30 jours** après la notification ; le serveur la sert (`avisAttribution.echeance`) et alerte la PRMP à l'approche.
- Modèle d'avis : celui de l'ARMP, s'il existe (Q7) ; sinon un modèle proposé, sur le modèle de l'avis spécifique.

> ⚠️ **Backend, 2026-10-07 — B4.4 livré (tranche 2c, V81)** :
> - `POST …/lots/{lot}/avis` `{ datePublication }` (entre la notification et aujourd'hui, 400 `DATE_INVALIDE`) ; 409 `NON_NOTIFIE`,
>   `DEJA_PUBLIE`. Réponse : l'`AttributionDto` (état **`PUBLIE`**). L'avis se télécharge par **`GET …/lots/{lot}/avis`** (`?format=docx`),
>   et **sans session** par `GET /api/procedures-en-ligne/{idDmc}/avis-attribution/{lot}` ; `ResultatPublic` gagne
>   `datePublicationAvis` et `avisDisponible`.
> - `lots[].avisAttribution` = `{ echeance, datePublication, publieLe, par, disponible }`, servi dès la notification ; `echeance` =
>   notification + 30 jours. Une publication tardive est acceptée et journalisée. **L'alerte à l'approche** (J-5) vient avec les
>   notifications de la tranche 2d.
> - **Modèle provisoire** (Q7) signé électroniquement par la PRMP : autorité contractante, référence et objet, nombre d'offres ouvertes,
>   attributaire et NIF, montant HT (et TTC lu), délai, dates de signature, d'enregistrement et de notification. Les mentions de l'arrêté
>   du Ministre des Finances restent à reprendre avec le modèle officiel.

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

> ⚠️ **Backend, 2026-10-07 — B5 livré (tranche 2c, V81)**, avec ces précisions et un ajout :
> - **Point de départ des 15 jours** : la « notification de l'attribution » est lue comme la **lettre d'attribution**, c'est-à-dire
>   l'information des candidats (§B4.1), et non la notification du marché (§B4.3). Le retrait, prévu « en vue d'une réattribution », ne
>   se conçoit qu'avant la signature. L'échéance est `piecesAttributaire.echeance` = information + 15 jours ; les âges (fiscale < 6 mois,
>   sociale < 3 mois) se comptent à la même date. *À confirmer par le juriste.*
> - **Ajout : la signature attend les deux pièces reconnues conformes** (409 `PIECES_NON_CONFORMES`). Sans ce verrou, la PRMP pourrait
>   signer au 11e jour un marché qu'elle devrait retirer au 16e.
> - **Dépôt** : multipart `type`, `dateDelivrance`, `fichier` → **201** avec `PiecesAttributaire` ; 400 `TYPE_INVALIDE`,
>   `DATE_DELIVRANCE_OBLIGATOIRE`, **`PIECE_PERIMEE`**, `FICHIER_OBLIGATOIRE`, `FORMAT_INVALIDE` ; 409 `NON_ATTRIBUTAIRE`, `DELAI_DEPASSE`,
>   et en plus `DEJA_SIGNE`, `LOT_RETIRE`. L'attributaire peut redéposer jusqu'à l'échéance : la dernière pièce de chaque type fait foi.
>   En plus : `GET /api/candidat/offres/{idOffre}/pieces-attributaire` et `GET …/pieces-attributaire/{id}/fichier`.
> - **Vérification** : `{ conforme, motif? }` ; 400 `CONFORME_OBLIGATOIRE`, `MOTIF_OBLIGATOIRE` (non conforme sans motif) ; 409
>   `DEJA_VERIFIEE`. Notification `PIECE_ATTRIBUTAIRE_VERIFIEE` à l'attributaire ; `PIECES_ATTRIBUTAIRE_DEPOSEES` à la PRMP au dépôt.
> - **Retrait** : `{ motif }` ; 409 `DELAI_EN_COURS` (jusqu'à l'échéance incluse), et en plus `PIECES_CONFORMES`, `DEJA_SIGNE`,
>   `LOT_RETIRE`, `NON_INFORME` ; état **`RETIRE`**, `lots[].retrait` = `{ le, par, motif }`, notification `MARCHE_RETIRE`. La
>   **réattribution (Q8)** vient en tranche 2d, avec un **nouveau dossier `DDM`** pour le nouvel attributaire (proposition retenue).
> - Servies dans `lots[].piecesAttributaire` = `{ echeance, delaiDepasse, fiscaleConforme, socialeConforme, pieces[{ id, type,
>   dateDelivrance, nom, taille, deposeLe, conforme, motif, verifieeLe }] }`, dès l'information. Côté candidat, `Resultat` gagne
>   `dateSignature`, `dateNotification`, `notificationRecueLe`, `marcheDisponible`, `piecesAttributaire` (attributaire seul) et `retire`.

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

> ⚠️ **Backend, 2026-10-08 — infructuosité et Q3 livrés (tranche 2d-1, V91)** ; contrat : `docs/api-endpoints.md`, § *… tranche 2d-1*.
> La tranche 2d est découpée (arbitrage du pilote, 08/10) : **2d-1** infructuosité, Q3, §B7 ; **2d-2** réattribution (Q8) ; **2d-3**
> sans suite par un dossier dans le circuit (Q10) — `…/sans-suite` et `…/sans-suite/avis` ci-dessus ne sont **pas** livrés.
> - **`POST …/lots/{lot}/infructueux`** comme proposé (`{ motif, decision{ reference, date }, suite? }`), PRMP seule. **Écart** : pas
>   « sans offre conforme » à part — c'est le rapport qui le propose (`proposition.infructueux`) ; **en plus**, après l'avis **`DEF`**
>   de la Commission (Q3). Statuts en plus : 400 `DECISION_OBLIGATOIRE`, `DECISION_DATE_INVALIDE`, `SUITE_INVALIDE`, `MOTIF_OBLIGATOIRE` ;
>   409 `DEJA_ATTRIBUE` (art. 56-VI), `DEJA_INFRUCTUEUX`, `INFRUCTUOSITE_NON_PROPOSEE`. État de lot **`INFRUCTUEUX`**, `lots[].infructuosite`
>   = `{ le, par, motif, decisionReference, decisionDate, suite }` ; `PROCEDURE_INFRUCTUEUSE` à chaque candidat du lot ; page publique :
>   `ResultatPublic` gagne `infructueux`, `motifInfructuosite`, `dateDecision`.
> - **Q3, la reprise** (arbitrage du 08/10 : évaluation rouverte en entier) : **`POST …/lots/{lot}/reprendre`** `{ motif }`, PRMP seule,
>   après l'avis `DEF` (409 `AVIS_NON_DEFAVORABLE`, `AUTRES_LOTS_ATTRIBUES`). Le rapport signé est archivé
>   (`lots[].reprises[{ id, le, par, motif, idDossier, avis, rapportDisponible }]`, `GET …/attribution/reprises/{id}/rapport`), l'évaluation
>   redevient `EN_COURS`, le président rouvre l'étape voulue, un nouveau rapport est signé, puis un nouveau dossier de marché.
>   `EVALUATION_REPRISE` aux membres de la CAO.

## B7 — Accès, notifications, journal, compteurs

- **Accès** : la PRMP agit ; l'UGPM et le responsable lisent ; les membres de la CAO lisent l'état de leurs lots ; le candidat ne voit
  que **son** résultat, ses lettres, ses explications et, attributaire, ses pièces.
- **Notifications** (proposées) : `RESULTAT_DISPONIBLE` (candidats, et courriel), `ATTRIBUTION` (attributaire), `EXPLICATION_DEMANDEE`
  et `EXPLICATION_REPONDUE`, `DELAI_ATTENTE_ECOULE` (PRMP), `PIECES_ATTRIBUTAIRE_DEPOSEES` (PRMP), `ECHEANCE_AVIS_ATTRIBUTION` (PRMP,
  à J-5), `PROCEDURE_INFRUCTUEUSE`, `PROCEDURE_SANS_SUITE` (candidats).
- **Compteurs** (`/api/kpis/badges`, PRMP) : lots à attribuer (avis rendu), lots signables (délai écoulé), avis d'attribution à publier,
  explications sans réponse.

> ⚠️ **Backend, 2026-10-08 — §B7 livré (tranche 2d-1, V91)**, sauf `PROCEDURE_SANS_SUITE` (2d-3) :
> - **Compteurs** dans `compteurs` (PRMP) : `lotsAAttribuer` (avis favorable `FAV`/`FAVR` rendu, non attribués), `lotsSignables`,
>   `avisAPublier`, `explicationsSansReponse`.
> - **Alertes** (planificateur horaire, une fois chacune) : `DELAI_ATTENTE_ECOULE`, `ECHEANCE_AVIS_ATTRIBUTION` (J-5 de l'échéance de
>   30 jours), et **en plus** `ECHEANCE_REEXAMEN` (réexamen sans réponse, J-2 de son échéance de 10 jours). Plus `PROCEDURE_INFRUCTUEUSE`
>   (candidats) et `EVALUATION_REPRISE` (membres de la CAO).

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

> ⚠️ **Backend, 2026-10-07 — D1 et D2 corrigés (avec la tranche 2b)** :
> - **D1** — cause confirmée : la séance de la fiche 40 a été close le 04/10, **avant V70** ; son PV n'a donc pas de date de signature,
>   et la tranche 2a ne joignait que le PV « signé ». Un PV figé à la clôture d'une séance est désormais tenu pour définitif. **V80
>   rattrape** le dossier **100371** : la pièce 17 y est jointe au prochain démarrage (seul dossier concerné en recette, vérifié en
>   lecture).
> - **D2** — le délai porte son unité : « 6 mois » (`Proposition.delai`, rapport §8, projet de marché article 4, lettres). Le projet
>   déjà produit du dossier 100371 garde son texte.

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

> ✅ **Front, 2026-10-07 — tranches 2b et 2c livrées.** Côté PRMP, sous chaque lot de la section « Attribution »
> (`features/evaluation/attribution-lot.ts`), le suivi de bout en bout, chaque geste à son tour : attribuer à l'offre proposée ; informer
> (date d'affichage, lettres PDF/Word avec envoi et accusé de lecture, délai d'attente et `signableLe`) ; répondre aux explications ;
> recours (déclaration typée, suspension et `finSuspension`, échéance du réexamen, décision) ; pièces de l'attributaire (vérification,
> retrait) ; mise au point ; signature ; enregistrement ; notification (réception déclarée ou accusé de lecture) ; avis d'attribution. Les
> refus sont nommés (codes du contrat). L'UGPM, le responsable et la commission lisent sans geste. Côté candidat, « Mes offres »
> (`features/candidat/resultat-offre.ts`) : résultat, motif, lettre, demande d'explication ; attributaire : dépôt des pièces fiscale et
> sociale, leur vérification, le marché signé (le lire vaut réception). Page publique : le résultat par lot et l'avis d'attribution publié.
>
> ✅ **Recette du 2026-10-07 (fiche 44)** : dossier de marché 100372 passé au circuit (pièce 16 jointe par la PRMP, grille DDM de 9 points,
> avis **FAV**, PV 57 signé) → attribué à l'offre n° 4 (166 000 000 HT, 3 mois) → candidats informés (deux lettres envoyées et lues ;
> signature possible le 18/10) → explication du candidat écarté, réponse écrite → pièces fiscale et sociale déposées et reconnues
> conformes → recours en révision ARMP déclaré (suspensif jusqu'au 27/10) → **signature refusée** (`DELAI_ATTENTE`, nommé) → mise au point
> enregistrée → résultat public affiché. Non recettés faute de délai écoulé : signature, enregistrement, notification, avis, retrait.
> Incident : un « Informer » lancé à l'écran pendant une recompilation du serveur de développement a échoué (statut 0) ; rejoué par
> l'API (5 s, conforme). Aucun constat pour le backend.
