# Demande backend — 2026-11-02 — Appel d'offres restreint (DAOR) : motif, liste restreinte, appel à candidatures, décision, délais, ouverture anticipée

## Contexte

Le pilote ouvre le chantier du **dossier d'appel d'offres restreint** (DAOR, et DAORI pour l'international). Une partie existe :

- le sous-type DAOR/DAORI, sa grille (grille DAOO + 5 points, `PointsCtrlManuelSeeder`) et ses pièces (`V95` : lettre d'invitation,
  PV de validation de la liste restreinte) ;
- la création par la fiche (informations du DAO) d'une ligne du plan dont le mode dit « restreint » (`ValeursPpmService.modeRestreint`) ;
- la lettre d'invitation `LETTRE-AOR` à la place de l'avis (tranche R3c, 13/10), candidats saisis (`SOURCE = SAISIE`).

Il manque ce que le code, le décret et le manuel demandent en propre au restreint. Références :

- loi n° 2016-055, art. 34, 38 (I à VI) et 56-I c) ;
- décret n° 2019-1310, art. 2-2, 2-3 b), 10 à 15 ;
- manuel de procédures internes des Commissions des Marchés, § III.4 et III.6 ;
- circulaire de régulation 2024.

**Arbitrages du pilote (02/11)** :

| Question | Décision |
|---|---|
| Q1 — Une seule offre reçue | On suit la **circulaire 2024** : une offre unique ne rend pas l'appel infructueux si elle est conforme et acceptable et que le candidat a les capacités requises. Écart assumé avec la loi, art. 56-I c), à valider par le juriste. |
| Q2 — La liste restreinte | **Les deux** : saisie avec PV joint (B3) **et** appel à candidatures en ligne (B4). |
| Q3 — La décision autorisant le lancement | **Les deux** : un projet produit par l'application **et** la version signée jointe par la PRMP (B5). |
| Q4 — L'ouverture anticipée (art. 38-VI) | **L'outiller** (B7). |

Ordre souhaité : **B1** d'abord (le seul défaut qui expose une procédure), puis B2, B3, B6, B5, B7, B8, et B4 en dernier.

## B1 — Un AOR en ligne n'est visible que de ses invités (correctif)

`ProceduresEnLigneService.restreinte(Lue)` ne reconnaît que les prestations intellectuelles :
`ModelesDao.sigleLettre(categorie) != null`. Un appel d'offres restreint de fournitures ou de travaux en remise électronique est
donc :

- listé dans les procédures ouvertes (« Avis ouverts ») ;
- visible de tous ;
- ouvert au retrait et au dépôt de n'importe quel candidat.

Demande : `restreinte` doit valoir aussi pour un mode restreint, c'est-à-dire `sigleLettre(categorie, modeRestreint) != null`.
Avec cette règle :

- l'AOR sort de la liste publique ;
- il est introuvable (404) hors de ses invités ;
- le retrait et le dépôt répondent 403 `NON_INVITE` ;
- il apparaît dans `GET` « mes invitations » du candidat invité.

Les invités sont ceux qu'écrit l'impression des lettres `LETTRE-AOR` (`InvitationsService.enregistrer`) : à vérifier qu'elle les écrit
bien pour l'AOR comme pour la PI. Un test d'intégration qui couvre un AOR de travaux est souhaité.

## B2 — Le motif du recours au restreint, sur la fiche

Loi, art. 38-IV ; décret, art. 10. La fiche de présentation du manuel porte une ligne « Justification (si DAOR) ». Le premier point
de la grille DAOR est le motif.

- Un **motif**, l'un des quatre cas : `URGENCE_AVEREE`, `CONFIDENTIEL`, `PRESTATAIRE_DEFAILLANT`, `PETIT_NOMBRE`.
- Une **justification** en texte libre.
- Des **pièces justificatives** facultatives, jointes au dossier DAOR.
- La validation de la fiche d'une ligne en mode restreint est refusée sans motif ni justification (400 nominatif).
- Le motif et la justification sont repris :
  - dans la fiche de présentation produite (ligne « Justification ») ;
  - dans les données que la Commission lit à l'examen, en regard du point « Motif de l'appel d'offres restreint ».
- Le motif commande le délai (B6). La grille dit aussi d'où vient la liste selon le motif (B3).

Forme proposée, à votre choix : des champs de la fiche servis avec la version, comme les autres valeurs.

## B3 — La liste restreinte, saisie (Q2, première voie)

Décret, art. 11-2 et 13 ; loi, art. 38-II.

- Pour une fiche en mode restreint, une **liste de candidats** : nom ou raison sociale, adresse, adresse électronique ou compte
  candidat, et NIF quand il est connu.
- Une **source** pour la liste :
  - `APPEL_CANDIDATURES` : B4 ;
  - `BASE_AUTORITE` : base de données de l'autorité contractante ;
  - `PREMIER_APPEL_OFFRES` : candidats qualifiés du premier appel d'offres, cas du prestataire défaillant ;
  - `REGISTRE_ARMP` : registre de l'ARMP ;
  - `ORGANISME_PROFESSIONNEL` : cas du petit nombre ; la grille cite OMERT, OMH, chambre de commerce.
- **Au moins trois candidats** : refus nominatif en dessous.
- Le **PV de validation de la liste par la CAO** reste la pièce `PV_LISTE_RESTREINTE`, jointe par la PRMP. Si la liste vient de B4, il
  est produit par l'application.
- La lettre `LETTRE-AOR` **reprend cette liste** : plus de seconde saisie au moment de l'impression. On garde une lettre par candidat,
  et les invités sont écrits à l'impression.
- La liste se lit au dossier DAOR et à l'examen (point « Constitution de la liste restreinte »).

## B4 — L'appel à candidatures en ligne (Q2, seconde voie)

Décret, art. 11-1. Même chemin que l'AMI en ligne (`AmiService`, `AmiPreselectionService`, `/api/fiches-marche/{idDmc}/ami`,
présélection, arrêt de la liste, rapport signé). Ce qui change pour le restreint :

- **Un avis d'appel à candidatures** publié dans « Avis ouverts ». Le décret lui impose au minimum : la nature et l'objet de la
  prestation, la date et le lieu de remise des candidatures, les critères de qualification requis.
- **Le dépôt d'une candidature** par un compte candidat : capacités, garanties financières et professionnelles, avec ses pièces. Il n'y
  a ni offre ni prix à ce stade.
- **L'examen par la CAO** : l'ouverture des candidatures, puis la sélection des candidats aptes. La CAO arrête une liste d'au moins
  trois candidats.
- **Le PV de validation de la liste**, produit et signé par la commission, comme le rapport de présélection de l'AMI. Il tient lieu de
  `PV_LISTE_RESTREINTE`, joint d'office.
- La liste ainsi arrêtée **alimente B3** (source `APPEL_CANDIDATURES`, comptes candidats), puis la lettre.
- **Dispense** : pas d'appel à candidatures quand le motif est `PETIT_NOMBRE` (art. 13) ou quand la PRMP sélectionne directement
  (art. 11-2) ; on passe alors par B3.
- L'appel à candidatures peut être lancé dès le début d'année pour constituer une base réutilisable (art. 11-1). Ce point **n'est pas
  demandé dans ce lot**, il est seulement signalé.

## B5 — La décision autorisant le lancement (Q3)

Manuel, § III.4 (projet de décision au DAOR) et § III.6 (décision signée et copie de la lettre avec accusé de réception, au marché).

- Une pièce `DECISION_AOR`, obligatoire pour DAOR et DAORI.
- **Un projet produit par l'application** à partir d'un modèle :
  - référence de la ligne, objet, motif et justification (B2), liste des candidats (B3) ;
  - joint d'office au dossier DAOR, comme le DAO complet ou le projet de lettre ;
  - filigrane « PROJET ».
- **La version signée** se joint par la PRMP. Elle remplace le projet et devient exigée au dossier de marché (MAOR, MAORI).
- Au MAOR et au MAORI, la **copie de la lettre d'invitation avec accusé de réception** remplace la copie de la publication de l'avis.
  Le manuel le prévoit ; à ajouter aux pièces si ce n'est pas fait.
- Le texte du modèle est à proposer au pilote pour relecture.

## B6 — Les délais du restreint

Décret, art. 2-2, 2-3 b) et 14.

- `PUBLICITE_AOR` vaut **15** jours, avec la mention « valeur à confirmer » (`V106`). Le décret dit **20 jours** minimum pour le restreint.
- Ajouter `PUBLICITE_AOR_URGENCE` = **10** jours, appliqué quand le motif (B2) est `URGENCE_AVEREE`.
- Ces délais se comptent depuis **l'envoi des lettres d'invitation**. L'ouverture des plis ne peut intervenir moins de 20 jours (10 en
  urgence) après cet envoi (art. 14), sauf l'ouverture anticipée (B7).
- La circulaire 2024 prévoit aussi 5 jours dans le cadre des « cent jours du Président ». C'est une mesure exceptionnelle : elle n'est
  **pas** demandée.

## B7 — L'ouverture anticipée des plis (Q4)

Loi, art. 38-VI ; décret, art. 14 ; guide de la CAO, § 4.5.1.

- Possible seulement quand **tous les invités ont remis leur offre** avant la date limite.
- La PRMP **demande le consentement** de chaque invité. Chaque invité **consent par écrit** depuis son espace : un geste horodaté, avec
  son nom, conservé au journal de la procédure.
- Quand **tous** ont consenti, la PRMP **fixe la nouvelle date d'ouverture**, notifiée à tous les invités pour qu'ils puissent y assister.
  La séance peut alors s'ouvrir à cette date. La part de secours et la cérémonie des clés suivent la date nouvelle.
- Un refus, ou une absence de réponse, laisse la date initiale.
- À lire au PV d'ouverture : la mention de l'ouverture anticipée et des consentements.

## B8 — Une seule offre reçue (Q1)

Circulaire 2024 : « une seule offre remise n'implique pas nécessairement le rejet de l'offre si celle-ci est conforme et acceptable et
que le candidat dispose des qualifications et capacités requises ». Il faut donc vérifier :

- qu'aucune règle du serveur ne déclare d'office infructueux un AOR à offre unique : séance, évaluation, `AttributionService` ;
- que l'évaluation suit son cours normal ; l'infructuosité reste possible si l'offre est non conforme ou inacceptable.

À consigner : l'écart avec la loi (art. 56-I c), retenu par le pilote, à valider par le juriste.

## Questions ouvertes

| Q | Sujet |
|---|---|
| Q5 | Le texte de la lettre `LETTRE-AOR` (R3c, 13/10) attend toujours la relecture du pilote. |
| Q6 | Le délai de l'appel à candidatures (B4) : le décret renvoie aux « formes de publicité prévues à l'article 2 » sans fixer de durée propre. Proposer un paramètre administrable, `PUBLICITE_AOR_CANDIDATURES`, à confirmer par le juriste. |
| Q7 | Le texte du modèle de décision autorisant le lancement (B5). |

## Côté front, en attendant

- **B2** : un bloc « Motif du recours » à l'étape de cadrage de la fiche, quand la ligne est en mode restreint. On y trouve le choix du
  cas, la justification et les pièces. Le bloc est repris dans la fiche de présentation en données.
- **B3** : la liste restreinte s'affiche au-dessus de la lettre d'invitation : saisie, source, compteur « au moins 3 », PV de la CAO.
  La lettre ne redemande plus les candidats.
- **B4** : on reprend l'écran de présélection de l'AMI (`/procedure/:idDmc/ami`) ; côté candidat, l'avis d'appel à candidatures et le dépôt.
- **B5** : la décision s'ajoute aux documents du dossier ; un bouton permet de joindre la version signée.
- **B7** : dans la séance, « Proposer l'ouverture anticipée » quand tout le monde a déposé ; côté candidat, « Consentir ».
- Tous les nouveaux champs sont lus comme facultatifs : tant qu'un lot n'est pas livré, l'écran garde son comportement actuel.
