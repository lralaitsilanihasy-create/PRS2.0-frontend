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

> ⚠️ **2026-11-02 — B2 livré (PRS20, V155), avec quatre écarts de forme.**
> - **Forme : une route propre, pas des champs du référentiel.** Les conditions du référentiel ne lisent que le cadrage, pas le mode du
>   plan : des champs « motif » ne sauraient s'ouvrir pour le seul restreint. Le motif s'écrit par `PUT /api/fiches-marche/{idDmc}/
>   motif-restreint` (`{ motif, justification }`) et se lit par `GET` ou dans `FicheMarcheDto.motifRestreint`, à côté du nouveau
>   booléen `modeRestreint`. Il reste **par version**, comme les autres valeurs : figé à la validation, recopié à la révision.
> - **Refus à la validation : 409 `CONTROLES_BLOQUANTS`, pas un 400.** Le manque est un contrôle **bloquant au bilan**
>   (`MOTIF_RESTREINT`, champs `motif` et `justification`), visible avant de valider comme les autres manques. Le 400 nominatif est
>   celui de l'écriture (`motif` inconnu, `justification` vide ou trop longue).
> - **À l'examen** : pas de lien propre au point de la grille. La Commission lit le motif dans la fiche de présentation (section
>   `PROCEDURE`, lignes `MOTIF_RESTREINT` et `JUSTIFICATION_RESTREINT` « Justification (si DAOR) »), comme le reste de la fiche.
> - **Pièces justificatives** : une pièce du dossier, `JUSTIFICATIF_AOR`, **facultative**, ajoutée aux listes DAOR et DAORI ; elles ne
>   sont pas portées par la fiche.
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

> ⚠️ **2026-11-02 — B3 livré (PRS20, V156), trois précisions.**
> - **Où** : `GET` / `PUT /api/fiches-marche/{idDmc}/liste-restreinte` (`{ source, candidats[{ nom, adresse, email, idCandidat, nif }] }`)
>   et `FicheMarcheDto.listeRestreinte`. La liste est **par version de fiche**, comme le motif (B2) : figée à la validation, recopiée à
>   la révision ; contrôle bloquant `LISTE_RESTREINTE` au bilan. Trois candidats au moins (400 `candidats`), nom et adresse obligatoires,
>   doublons refusés.
> - **`APPEL_CANDIDATURES` ne se saisit pas** (400 `source`) : c'est la source que posera l'appel à candidatures en ligne (B4). Les quatre
>   autres sources se saisissent.
> - **La lettre** : `candidats` du corps de `POST …/lettres-invitation` est **ignoré** dès que la version validée porte sa liste (seuls
>   `dateEnvoi` et `lieu` restent saisis). Un candidat avec `idCandidat` est rattaché d'emblée à son compte et notifié ; sinon son
>   adresse électronique, comme avant. La lecture « au dossier et à l'examen » passe par la fiche de présentation (ligne
>   `LISTE_RESTREINTE`). Pas de contrôle croisé motif / source : la grille l'indique, le serveur ne l'impose pas.
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

> ⚠️ **2026-11-02 — B5 livré (PRS20, V158-V159), avec un modèle provisoire et deux écarts.**
> - **Le projet** : produit à la validation d'une version en mode restreint (motif, justification, liste restreinte, « PROJET » en
>   filigrane) et joint d'office au dossier DAOR. ⚠️ **Écart de nom** : il est joint sous la pièce **`DECISION_AO_RESTR`**, qui existe
>   depuis V95, et non sous un nouveau code `DECISION_AOR`. Cette pièce est désormais exigée aux DAOR, DAORI et DAOR-CC. Il est listé
>   avec les projets de publication (« Projet de décision autorisant l'appel d'offres restreint »).
> - **Le modèle est provisoire** (Q7) : son texte est à relire par le pilote. Le pied de page le dit.
> - ⚠️ **Écart — où se joint la version signée.** Elle se dépose au **dossier de marché** (MAOR, MAORI, MAOR-CC), où
>   `DECISION_AO_RESTR` est exigée depuis V95, et non à la place du projet sur le DAOR. Le DAOR est examiné avec le projet (manuel,
>   § III.4) ; la décision est signée après l'avis de la Commission, quand le DAOR n'accepte plus de pièce. Le bouton « joindre la
>   version signée » relève donc de l'écran du dossier de marché.
> - **Lettres avec accusé** : pour un AOR, `POST /api/fiches-marche/{idDmc}/publication-avis` attend désormais des lettres
>   (`LETTRES_INVITATION`, sans journal), comme en PI. Au dossier de marché, la pièce `LETTRES_ACCUSE` est **fournie** par ce dépôt,
>   déjà présente aux listes MAOR et MAORI. Les MPI en profitent aussi.
## B6 — Les délais du restreint

Décret, art. 2-2, 2-3 b) et 14.

- `PUBLICITE_AOR` vaut **15** jours, avec la mention « valeur à confirmer » (`V106`). Le décret dit **20 jours** minimum pour le restreint.
- Ajouter `PUBLICITE_AOR_URGENCE` = **10** jours, appliqué quand le motif (B2) est `URGENCE_AVEREE`.
- Ces délais se comptent depuis **l'envoi des lettres d'invitation**. L'ouverture des plis ne peut intervenir moins de 20 jours (10 en
  urgence) après cet envoi (art. 14), sauf l'ouverture anticipée (B7).
- La circulaire 2024 prévoit aussi 5 jours dans le cadre des « cent jours du Président ». C'est une mesure exceptionnelle : elle n'est
  **pas** demandée.

> ⚠️ **2026-11-02 — B6 livré (PRS20, V157), avec deux écarts et une question au pilote (Q8).**
> - **Livré** : `PUBLICITE_AOR` passe à **20 jours** (décret, art. 14). Le paramètre n'est mis à jour que si l'Administrateur ne l'avait
>   jamais modifié. Nouveau paramètre `PUBLICITE_AOR_URGENCE`, **10 jours**, lu quand le motif du recours (B2) est `URGENCE_AVEREE`.
>   Le contrôle `DELAI_PUBLICITE` du bilan en tient compte.
> - **Écart 1 — toujours signalé, pas bloquant.** Ces deux délais restent des paramètres administrables : un manque est un
>   avertissement, comme pour tous les délais hors la loi (arbitrage Q6 du pilote, 13/10). Le serveur ne renverse pas cet arbitrage
>   seul ; voir Q8.
> - **Écart 2 — le départ du délai.** Au bilan, le départ reste la date de publication prévue (`B04-SE-17`), à défaut le lancement du
>   plan. La date d'envoi des lettres n'est contrôlée ni à l'impression ni contre l'ouverture des plis : un paramètre non bloquant n'y
>   arrêterait rien. Si Q8 rend le délai bloquant, les deux contrôles suivront.
> - **Q8 (au pilote)** : le décret fixe 20 jours au moins (10 en urgence avérée). Faut-il rendre ce délai **bloquant**, comme les délais
>   de la loi (validation de la fiche, puis impression des lettres contre leur date d'envoi) ?
## B7 — L'ouverture anticipée des plis (Q4)

Loi, art. 38-VI ; décret, art. 14 ; guide de la CAO, § 4.5.1.

- Possible seulement quand **tous les invités ont remis leur offre** avant la date limite.
- La PRMP **demande le consentement** de chaque invité. Chaque invité **consent par écrit** depuis son espace : un geste horodaté, avec
  son nom, conservé au journal de la procédure.
- Quand **tous** ont consenti, la PRMP **fixe la nouvelle date d'ouverture**, notifiée à tous les invités pour qu'ils puissent y assister.
  La séance peut alors s'ouvrir à cette date. La part de secours et la cérémonie des clés suivent la date nouvelle.
- Un refus, ou une absence de réponse, laisse la date initiale.
- À lire au PV d'ouverture : la mention de l'ouverture anticipée et des consentements.

> ⚠️ **2026-11-03 — B7 livré (PRS20, V160), trois précisions.**
> - **Routes** : côté PRMP, `GET` / `POST /api/fiches-marche/{idDmc}/ouverture-anticipee` et `PUT …/ouverture-anticipee/date`
>   (`{ nouvelleOuverture }`). Côté invité, `GET /api/candidat/invitations/{idDmc}/ouverture-anticipee` et `POST …/consentement`
>   (`{ accord: true | false }`). États : `DEMANDEE` → `ACCORDEE` → `FIXEE`, ou `REFUSEE`.
> - **Offres figées dès la demande** (précision ajoutée) : tant que la demande n'est pas refusée, le candidat ne dépose, ne remplace ni ne
>   retire plus (409 `OUVERTURE_ANTICIPEE`). Sans cette garde, une offre pourrait changer après le consentement des autres.
> - **Un refus clôt la demande** (`REFUSEE`) : la date initiale demeure et une nouvelle demande n'est pas admise. La séance s'ouvre à la
>   date fixée, avant la date limite ; ses rappels suivent cette date, et le PV d'ouverture mentionne l'anticipation et chaque
>   consentement écrit. La part de secours n'a rien de propre : elle suit la séance. Les prestations intellectuelles sont exclues.
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

> ⚠️ **2026-11-02 — B1 livré (PRS20) ; B2 à B8 à suivre, dans l'ordre demandé.**
> - **B1** — règle corrigée : une procédure est « sur invitation » quand le modèle de lettre l'est, catégorie **et mode du plan**
>   (`ModelesDao.sigleLettre(catégorie, restreint)`). Un AOR de fournitures ou de travaux en remise électronique est lancé par ses
>   lettres `LETTRE-AOR`, sort de la liste publique, répond 404 hors de ses invités, 403 `NON_INVITE` au retrait et au dépôt, et paraît
>   dans `GET /api/candidat/invitations`. Les invités sont bien écrits à l'impression des lettres AOR (même chemin que la PI).
> - **Écart avec le constat** : avant le correctif, un AOR lancé par ses seules lettres n'était **pas reconnu comme lancé** (seule la PI
>   l'était) : il était introuvable de tous, invités compris, plutôt que public. Il n'était public que si un avis avait été imprimé.
> - L'offre d'un AOR reste en **une enveloppe** : les deux enveloppes (technique, financière) restent propres aux prestations
>   intellectuelles.
> - Test d'intégration : un AOR de fournitures (mode « restreint »), invité et non invité.