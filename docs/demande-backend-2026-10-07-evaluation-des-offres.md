# Demande backend — 2026-10-07 — Évaluation des offres, lot 1 : de l'examen de conformité au rapport d'évaluation

**Date** : 2026-10-07 · **Émetteur** : front · **Origine** : demande du pilote du 07/10 (« appliquer le guide d'évaluation des offres,
en commençant par les étapes 2 à 5 et le rapport ») ; *Guide d'évaluation des offres – Marchés publics à Madagascar*, version du
7 octobre 2026, fondé sur la loi n° 2016-055 du 25 janvier 2017 portant Code des marchés publics (art. 20, 21, 35, 43, 46 à 49) ;
soumission en ligne livrée : séance d'ouverture et PV (lot 4, V69), offre remplie en ligne (lot 5, formulaires, manifeste format 3).

**Ce que le lot produit** : une fois le PV d'ouverture signé, la CAO **évalue** les offres ouvertes, lot par lot, en quatre étapes
tracées dans l'application, puis signe le **rapport d'évaluation** qui propose un attributaire à la PRMP :

| Étape du guide | Ce que fait la CAO | Ce qui en sort |
|---|---|---|
| 2 — Examen préliminaire | Recevabilité, éligibilité, conformité pour l'essentiel, offre par offre | Offres conformes ; offres écartées avec motif et clause du DAO |
| 3 — Évaluation détaillée | Corrections arithmétiques, montant évalué, classement | Le tableau d'évaluation (modèle p. 9 du guide) |
| 4 — Prix anormal | Justification écrite demandée avant tout rejet | Offres maintenues ou rejetées, échanges consignés |
| 5 — Post-qualification | Capacités du premier classé, puis du suivant s'il échoue | L'offre proposée à l'attribution |
| Rapport | Production, signature par les membres, observations | Le rapport d'évaluation signé, transmis à la PRMP |

L'attribution par la PRMP, l'information des candidats non retenus, la notification, l'avis d'attribution, les procédures
infructueuses et sans suite font l'objet d'un **lot 2** (§B8).

**Conventions** : les noms de routes, de champs, d'états et de codes sont **PROPOSÉS** ; le backend les fixe et corrige ce document
en place (encadré ⚠️ daté). Le front ne code rien contre un nom non confirmé. Les articles de loi sont ceux que cite le guide : ils
restent à valider sur les textes en vigueur (Q9).

**Le constat.** Aujourd'hui, la séance s'arrête au PV d'ouverture (`SeanceService`, état `CLOSE`). Elle fournit déjà, pour chaque
offre, presque tout ce que l'évaluation consomme — mais **aucune décision** n'est prise ni tracée :
- `GET /api/fiches-marche/{idDmc}/seance/lecture` → `OffreLue` : acte d'engagement (montants HT/TTC, délai, validité, **rabais en
  texte libre**), garantie (`presente`, `montant`, `emetteur`), pièces et `piecesManquantes`, `integrite`, `entreprise.verification`
  et `exclusion`, `totaux` recalculés depuis le bordereau scellé, `fraisDossier`, et **18 types d'alertes**, jamais des refus :
  `RAPPROCHEMENT`, `EXCLUSION`, `GARANTIE_INSUFFISANTE`, `FRAIS_NON_REGLES`, `FORMULAIRES_ILLISIBLES`, `PRIX_MANQUANT`,
  `TOTAL_DIVERGENT`, `AE_DIVERGENT`, `LETTRES_DIVERGENTES`, `PLAFOND_DEPASSE`, `NON_CONFORME`, `LIVRAISON_HORS_DELAI`,
  `CA_INSUFFISANT`, `LIQUIDITE_INSUFFISANTE`, `REFERENCES_INSUFFISANTES`, `PERSONNEL_INCOMPLET`, `MATERIEL_INCOMPLET`,
  `SOUS_DETAIL_INCOHERENT`.
- La fiche porte les critères publiés : évaluation par lot ou sur l'ensemble (`B06-EV-01` T / `B06-EO-01` F), critères additionnels
  (`B06-EO-02`), traitement des offres anormales (`B06-EO-07`), marge de préférence (`B06-PN-01`/`02` T, `B06-EO-09` et `B03-CQ-08` F),
  délai de réponse aux demandes (`B06-EP-01` F, `B06-RC-01` T), qualification (`B03-QT-*` T, `B03-CQ-*` F), garantie
  (`B05-GS-*` F, `B05-GQ-*` T), matériel et personnel (B13), pièces exigées (B14), variantes (`B02-LV-06`, `B02-VA-01`), montant
  estimatif (`B01-AC-14`). La rubrique `B06-SD` « Attribution, appel infructueux, notification » existe sans champ.
- Aucun champ ne dit **comment corriger** une erreur arithmétique : la règle est celle des Instructions aux candidats (texte fixe
  du DAO complet) — le prix unitaire prévaut sur le total, les lettres sur les chiffres.

---

## Principes communs à toutes les étapes

- **P1 — La règle d'or** : aucun critère, aucune pièce, aucune pondération hors du DAO. Le serveur **dérive** les critères de la
  version validée de la fiche ; il n'existe **aucune route** pour en ajouter un. Un critère du DAO rédigé en texte libre
  (`B06-EO-02`, `B03-CQ-02`…) est repris tel quel, et la CAO y répond en texte motivé.
- **P2 — Les alertes de séance sont des constats, jamais des décisions.** Elles pré-remplissent chaque étape ; la CAO décide.
  Aucune offre n'est écartée sans un geste humain motivé.
- **P3 — Chaque décision est motivée et tracée** : auteur, date, motif, **clause du DAO** visée. Rien ne s'efface : une décision
  corrigée laisse l'ancienne au journal (append-only, comme le suivi des observations FAVR).
- **P4 — Par lot.** L'évaluation, le classement et la post-qualification se font lot par lot (art. 47-III), une offre étant
  déposée pour un lot.
- **P5 — Confidentialité (art. 12-V, 35-V)** : rien n'est visible des candidats avant l'information officielle (lot 2) ; la PRMP
  et l'UGPM lisent ; seuls les membres de la CAO décident.
- **P6 — Déclaration préalable** : chaque membre signe, avant toute décision, une **déclaration d'absence de conflit d'intérêts et de
  confidentialité** (art. 21-d, 12-V ; check-list du guide). Un membre qui déclare un conflit ne décide rien sur la procédure.

## B1 — L'évaluation d'une procédure : son état et son déroulé

| Méthode | URL | Accès | Corps / réponse | Statuts |
|---|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/evaluation` | CAO, responsable, PRMP, UGPM | `EvaluationDto` (ci-dessous) ; 404 si non ouverte | |
| POST | `/api/fiches-marche/{idDmc}/evaluation/ouvrir` | responsable de la procédure (titulaire) | → `EvaluationDto` | 409 `SEANCE_NON_CLOSE`, `EVALUATION_DEJA_OUVERTE` |
| POST | `/api/fiches-marche/{idDmc}/evaluation/declaration` | membre de la CAO | `{ conflit: bool, precision? }` → 200 | 409 `DEJA_DECLARE` |
| POST | `/api/fiches-marche/{idDmc}/evaluation/lots/{lot}/etapes/{etape}/arreter` | président de la CAO | `{ observation? }` → `EvaluationDto` | 409 `ETAPE_INCOMPLETE` (une offre sans décision), `ETAPE_PRECEDENTE_OUVERTE` |
| POST | `/api/fiches-marche/{idDmc}/evaluation/lots/{lot}/etapes/{etape}/rouvrir` | président de la CAO | `{ motif }` (obligatoire) | 409 `RAPPORT_SIGNE` |

- `EvaluationDto` : `etat` (`EN_COURS`, `RAPPORT_A_SIGNER`, `CLOSE`), `declarations[{membre, signeeLe, conflit}]`, et par lot :
  `lots[{lot, etape (CONFORMITE | EVALUATION | ANORMALES | QUALIFICATION | RAPPORT), etapesArretees[{etape, par, le}],
  offres[OffreEvaluee]}]`.
- `OffreEvaluee` : `idOffre`, `numero`, `entreprise`, `conformite`, `evaluation`, `anormale`, `qualification` (une section par
  étape, `null` tant qu'elle n'est pas atteinte), `rang`, `ecartee` (`{etape, qualification, motif, clause, par, le}` ou `null`).
- Toute décision exige que son auteur ait signé sa déclaration (409 `DECLARATION_MANQUANTE`) sans conflit (403 `MEMBRE_EN_CONFLIT`).
- Une étape **arrêtée** fige ses décisions ; la rouvrir (avec motif) rouvre aussi les étapes suivantes du lot.

## B2 — Étape 2 : l'examen préliminaire (recevabilité, éligibilité, conformité)

Pour chaque offre ouverte du lot, une **grille de vérifications** pré-remplie par le serveur depuis la lecture, que la CAO confirme
ou corrige :

| Vérification | Pré-remplissage proposé | Conséquence si non satisfaite |
|---|---|---|
| Acte d'engagement présent, avec le prix (art. 46) | `acteEngagement` du manifeste (montant renseigné) | Rejet : pièce essentielle |
| Garantie de soumission, si exigée (art. 46) | `garantie.presente`, alerte `GARANTIE_INSUFFISANTE`, `B05-GS-01` / `B05-GQ-01` | Rejet : pièce essentielle |
| Une seule offre par candidat et par lot, seul ou en groupement (art. 22-V, 43) | Le serveur croise les NIF des offres du lot, groupements compris | Disqualification de toutes ses offres |
| Aucun cas d'exclusion (art. 21) | Alerte `EXCLUSION`, `entreprise.exclusion`, `entreprise.verification` | Rejet |
| Signataire habilité, pouvoirs joints | Pièce de pouvoir parmi `pieces` (si la fiche l'exige en B14) | Selon le DAO |
| Pièces exigées par le DAO (B14) | `piecesManquantes` | Selon le DAO : la CAO dit si la pièce est essentielle |
| Conformité pour l'essentiel aux spécifications | Alertes `NON_CONFORME`, `LIVRAISON_HORS_DELAI`, `PLAFOND_DEPASSE` | Rejet si condition essentielle |
| Intégrité de l'offre | `integrite` (`ALTEREE`, `LECTURE_IMPOSSIBLE`) | Voir Q6 |
| Frais de dossier | Alerte `FRAIS_NON_REGLES` | Voir Q7 (arbitrage du 05/10 : alerte, jamais rejet automatique) |

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| PUT | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/conformite` | membre de la CAO | `{ verifications[{code, satisfaite, observation?}], decision: CONFORME \| ECARTEE, qualification?: IRRECEVABLE \| NON_CONFORME \| INAPPROPRIEE \| INACCEPTABLE, motif?, clause? }` | 400 `MOTIF_OBLIGATOIRE`, `CLAUSE_OBLIGATOIRE` si ECARTEE ; 409 `ETAPE_ARRETEE` |
| POST | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/precisions` | PRMP (art. 35-VI) | `{ question, delaiJours? }` (défaut : `B06-EP-01` / `B06-RC-01`) | 409 `EVALUATION_CLOSE` |
| GET | `/api/candidat/offres/{idOffre}/precisions` | candidat de l'offre | les demandes reçues et leurs réponses | |
| POST | `/api/candidat/offres/{idOffre}/precisions/{idDemande}/reponse` | candidat de l'offre | multipart `{ texte }` + `fichier?` | 409 `DELAI_DEPASSE`, `DEJA_REPONDU` |

- Les quatre qualifications sont celles de l'article 1 reprises par le guide (tableau du §2.3).
- **Une précision ne change ni le prix ni une pièce essentielle manquante** (guide §2.4) : la règle ne se contrôle pas
  automatiquement ; la demande et la réponse sont **jointes au rapport**, et l'écran le rappelle à la PRMP et au candidat.
- Notifications : `PRECISION_DEMANDEE` au candidat (et par courriel), `PRECISION_RECUE` à la PRMP et aux membres.

## B3 — Étape 3 : corrections, montant évalué, classement

**3.1 Corrections arithmétiques.** Pour une offre remplie en ligne, le serveur **propose** les corrections depuis le bordereau scellé
(il recalcule déjà les totaux à l'ouverture) :
- ligne par ligne : prix unitaire × quantité de la fiche ; **le prix unitaire prévaut sur le total** ;
- en travaux : **les lettres prévalent sur les chiffres** (alerte `LETTRES_DIVERGENTES`) ;
- le total ainsi corrigé, comparé au montant de l'acte d'engagement (`AE_DIVERGENT`, `TOTAL_DIVERGENT`).

Chaque correction proposée : `{ ligne, libelle, avant, apres, regle (PU_PREVAUT | LETTRES_PREVALENT | REPORT) }`. La CAO les retient
ou non, et peut en saisir d'autres (offre sans formulaire, prestations sans besoin chiffré). Le **refus du candidat** d'une correction
écarte son offre si les IC le prévoient : la CAO l'enregistre (Q2 : acceptation dans l'application ou hors ligne ?).

**3.2 Montant évalué** (art. 47-II) : `montantEvalue = prixLu ± corrections − rabais + ajustementPreference + criteresMonetises`.
- **Prix lu** : celui de l'acte d'engagement, en HT ou TTC selon le DAO (Q3).
- **Rabais** : aujourd'hui un **texte libre** au dépôt ; la CAO en saisit la **valeur monétaire** et sa lecture (Q4 : rendre le rabais
  structuré au dépôt — pourcentage ou montant, conditions).
- **Préférence** : seulement si la fiche la prévoit (`B06-PN-01 = OUI` / `B03-CQ-08 = OUI`), au taux de la fiche (`B06-PN-02`,
  `B06-EO-09`), plafonné par le guide (§3.4 : 15 % ou 10 % selon le cas). La CAO marque l'offre **éligible** avec motif (Q8 : d'où
  vient l'origine nationale du candidat ?). La préférence sert à comparer, **jamais** au prix du marché.
- **Critères additionnels monétisés** : seulement ceux de `B06-EO-02` ; montant et justification par offre.

**3.5 Lots et variantes.** Par lot. Si la fiche prévoit l'évaluation **sur l'ensemble des lots** (`B06-EV-01` / `B06-EO-01`), le
serveur calcule aussi la combinaison la moins disante selon la méthode des DPAO (Q5 : la méthode est-elle toujours celle du DAO
type ?). Variantes : évaluées seulement si `variantes = OUI`, selon `B02-VA-01`.

**3.6 Classement** : par montant évalué **croissant**, offres conformes seules ; en cas d'égalité, voir Q5.

| Méthode | URL | Accès | Corps / réponse | Statuts |
|---|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/corrections-proposees` | CAO, PRMP, UGPM | `[{ligne, libelle, avant, apres, regle}]` | 409 `OFFRE_ECARTEE` |
| PUT | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/montant` | membre de la CAO | `{ corrections[{…, retenue}], refusCandidat?, rabais{montant, lecture}, preference{eligible, motif}, criteres[{libelle, montant, justification}] }` → `OffreEvaluee` (montant évalué calculé par le serveur) | 400 `PREFERENCE_NON_PREVUE`, `CRITERE_HORS_DAO` |
| GET | `/api/fiches-marche/{idDmc}/evaluation/lots/{lot}/tableau` | CAO, PRMP, UGPM | le tableau du guide (p. 9) : `[{numero, candidat, prixLu, garantie, conforme, motifRejet, prixCorrige, rabais, ajustements, montantEvalue, rang, qualifie}]` | |

## B4 — Étape 4 : offres anormalement basses ou hautes (art. 48)

- **Indicateurs, pas décisions** : pour chaque offre conforme, le serveur donne l'écart à l'**estimation** (`B01-AC-14`, par lot si
  la ligne est allotie) et à la **moyenne** des offres conformes du lot, et rappelle les alertes `SOUS_DETAIL_INCOHERENT`. La méthode
  de détection est celle du DAO (`B06-EO-07`) ; sans méthode, la CAO motive au cas par cas (guide §4).
- **Aucun rejet sans demande écrite** : `REJETEE` est refusé tant qu'une justification n'a pas été demandée **et** reçue ou son délai
  expiré (409 `JUSTIFICATION_NON_DEMANDEE`, `DELAI_EN_COURS`).
- Le rejet écarte l'offre (étape 4) et **reclasse** le lot ; la comparaison avec l'estimation et la réponse du candidat vont au
  rapport (art. 48-II).

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/evaluation/lots/{lot}/indicateurs-prix` | CAO, PRMP, UGPM | `[{idOffre, ecartEstimation, ecartMoyenne, alertes[]}]` | |
| POST | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/justification` | PRMP, sur proposition de la CAO | `{ elements (prix unitaires, sous-détails, moyens), delaiJours }` | 409 `DEJA_DEMANDEE` |
| POST | `/api/candidat/offres/{idOffre}/justification/reponse` | candidat de l'offre | multipart `{ texte }` + `fichiers?` | 409 `DELAI_DEPASSE` |
| PUT | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/anormale` | membre de la CAO | `{ suspectee: bool, decision?: MAINTENUE \| REJETEE, motif }` | 409 `JUSTIFICATION_NON_DEMANDEE`, `DELAI_EN_COURS` |

## B5 — Étape 5 : post-qualification du premier classé (art. 20, 47-V)

- Le serveur ouvre la post-qualification du **premier classé** de chaque lot, avec la liste des **critères du DAO** (art. 20-II :
  rien d'autre) :
  - capacité juridique : pièces de `B03-CQ-01`, absence d'exclusion, pouvoirs ;
  - capacité financière : `B03-QT-07`, `-14` à `-18` (T), `B03-CQ-03`, `-10` (F) ;
  - capacité technique et expérience : `B03-QT-08`, `-12`, `-19`, `-20` (T), `B03-CQ-02`, `-04`, `-06` (F) ; matériel et personnel
    exigés (B13) face à ceux de l'offre ;
  - chacun pré-rempli par les constats de séance (`CA_INSUFFISANT`, `LIQUIDITE_INSUFFISANTE`, `REFERENCES_INSUFFISANTES`,
    `PERSONNEL_INCOMPLET`, `MATERIEL_INCOMPLET`) et les valeurs déclarées (`capacites`, `personnel`, `materiel` des formulaires).
- La CAO dit pour chaque critère `SATISFAIT` / `NON_SATISFAIT` (motif), puis `QUALIFIE` ou `NON_QUALIFIE` (motif, clause).
- **Non qualifié** : l'offre est écartée (étape 5) et le serveur ouvre la post-qualification du **suivant**, jusqu'à un qualifié ou
  la fin du classement (alors : proposition d'infructuosité, lot 2).

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/evaluation/lots/{lot}/qualification` | CAO, PRMP, UGPM | `{ idOffre, criteres[{code, libelle, exigence, declare, constat, decision?}] }` | 409 `CLASSEMENT_NON_ARRETE` |
| PUT | `/api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/qualification` | membre de la CAO | `{ criteres[{code, decision, motif?}], decision: QUALIFIE \| NON_QUALIFIE, motif?, clause? }` | 409 `PAS_LE_TOUR_DE_CETTE_OFFRE` |

## B6 — Le rapport d'évaluation

- **Produit par le serveur** (PDF et Word), comme le PV d'ouverture, quand toutes les étapes de tous les lots sont arrêtées
  (409 `ETAPES_INCOMPLETES`). Plan proposé, celui du guide :
  1. références du marché, de l'avis et du DAO ; composition de la CAO et décision de désignation (`Cao.decisionReference`) ;
  2. plis reçus et renvoi au PV d'ouverture ;
  3. examen préliminaire : offres écartées, motif, clause du DAO ;
  4. corrections arithmétiques, offre par offre ;
  5. montant évalué et classement (le tableau de §B3) ;
  6. offres anormales : indicateurs, demandes, réponses, décisions ;
  7. post-qualification ;
  8. **proposition d'attribution** par lot : attributaire, montant (corrigé), délai ;
  9. signatures des membres, et **observations** des membres en désaccord ;
  en annexe : les déclarations des membres, les demandes de précisions et de justification avec leurs réponses.
- **Signature** : par les membres de la CAO, sur le modèle du PV d'ouverture (`POST /pv/signer`, empêchement constaté par le
  président). Un membre peut joindre une observation à sa signature. À la dernière signature : `CLOSE`, notification
  `RAPPORT_EVALUATION` à la PRMP et à l'UGPM. Le rapport n'est **pas public**.

| Méthode | URL | Accès | Corps | Statuts |
|---|---|---|---|---|
| POST | `/api/fiches-marche/{idDmc}/evaluation/rapport` | responsable de la procédure | `{ observations? }` → `RAPPORT_A_SIGNER` | 409 `ETAPES_INCOMPLETES` |
| GET | `/api/fiches-marche/{idDmc}/evaluation/rapport` (`?format=docx`) | CAO, responsable, PRMP, UGPM | le PDF (ou le Word) | 404 |
| POST | `/api/fiches-marche/{idDmc}/evaluation/rapport/signer` | membre de la CAO | `{ observation? }` | 409 `DEJA_SIGNE`, `RAPPORT_NON_PRODUIT` |
| POST | `/api/fiches-marche/{idDmc}/evaluation/rapport/empechement` | président de la CAO | `{ im, motif }` | |

## B7 — Accès, notifications, journal

| Acteur | Lit | Décide |
|---|---|---|
| Membre de la CAO (déclaration signée, sans conflit) | tout | conformité, corrections, montant, anormales (proposition), qualification ; signe le rapport |
| Président de la CAO | tout | en plus : arrête et rouvre les étapes, constate les empêchements |
| Responsable de la procédure (titulaire) | tout | ouvre l'évaluation, produit le rapport |
| PRMP | tout | demande les précisions (art. 35-VI) et les justifications (art. 48) |
| UGPM | tout | rien |
| Candidat | ses demandes et ses réponses seulement | répond |

- Notifications proposées : `EVALUATION_OUVERTE`, `PRECISION_DEMANDEE`, `PRECISION_RECUE`, `JUSTIFICATION_DEMANDEE`,
  `JUSTIFICATION_RECUE`, `RAPPORT_A_SIGNER`, `RAPPORT_EVALUATION`.
- Journal : chaque décision et chaque réouverture (auteur, date, avant / après, motif), consultable par la CAO et la PRMP.
- Compteurs (`/api/kpis/badges`) : décisions en attente pour le membre, demandes sans réponse pour la PRMP, rapport à signer.

## B8 — Hors de ce lot (lot 2, puis lot 3)

- **Lot 2 — de la proposition à la notification** : choix de l'attributaire par la PRMP (art. 35-VII), examen de l'organe de contrôle
  (art. 17), information des non retenus et **10 jours francs** avant signature (art. 52-I), demandes d'explication (art. 52-II),
  mise au point (art. 35-VIII), notification (art. 54), avis d'attribution sous 30 jours (art. 53), pièces fiscales et sociales de
  l'attributaire sous 15 jours (art. 20-I), procédure **infructueuse** (art. 56) et **sans suite** (art. 55, avis de l'organe de
  contrôle sous 5 jours) — la rubrique `B06-SD` les attend.
- **Lot 3 — prestations intellectuelles** (art. 42) : méthodes qualité et coût, budget déterminé, moindre coût, qualité technique
  seule, qualifications ; notation technique d'après `B06-TP-02` à `-07` et pondération `B06-CS-02`/`-03` ; ouverture des
  propositions financières **après** l'évaluation technique ; négociation avec le seul retenu.

## Hypothèses (à confirmer ou corriger)

- **H1** — Ce lot ne vaut que pour les procédures en **remise électronique** : leurs offres sont dans l'application. *Les offres
  papier sont-elles à évaluer dans l'application (saisie des offres par la CAO) ? — voir Q1.*
- **H2** — L'évaluation s'ouvre seulement quand la séance est `CLOSE` (PV d'ouverture signé) ; une séance `ILLISIBLE` n'a rien à
  évaluer.
- **H3** — Les offres `RETIREE` et `REMPLACEE` ne sont pas évaluées ; une offre `ECARTEE` au dépôt figure au rapport (§2) sans être
  évaluée.
- **H4** — Les décisions sont celles de la CAO **collégialement** : l'application enregistre la décision saisie par un membre et la
  rend visible aux autres ; le président l'arrête avec l'étape. *Faut-il un vote ou une validation par plusieurs membres ? — Q1.*
- **H5** — Les montants s'entendent par lot, en ariary, sur la même base (HT ou TTC) que celle que le DAO fixe pour la comparaison.

## Questions

| # | Question | À qui |
|---|---|---|
| Q1 | Qui saisit et qui arrête chaque étape : tout membre, le président seul, le responsable de la procédure ? Les offres papier entrent-elles dans le module (H1) ? | pilote |
| Q2 | La correction arithmétique est-elle soumise à l'acceptation du candidat **dans l'application** (comme une demande de précision), ou constatée hors ligne ? | pilote, juriste |
| Q3 | La comparaison se fait-elle en HT ou en TTC ? Une information de la fiche le dit-elle, ou faut-il en créer une ? | pilote, backend |
| Q4 | Le rabais doit-il devenir une donnée structurée au dépôt (pourcentage ou montant, conditions, lots concernés) ? | pilote |
| Q5 | Égalité de montant évalué ; méthode de combinaison des lots quand l'évaluation porte sur l'ensemble : celle du DAO type ? | juriste |
| Q6 | Une offre `ALTEREE` ou `LECTURE_IMPOSSIBLE` est-elle irrecevable d'office, ou la CAO en décide-t-elle ? | pilote, juriste |
| Q7 | Frais de dossier non réglés : l'arbitrage du 05/10 (alerte, jamais rejet) vaut-il aussi à l'examen de conformité ? | pilote |
| Q8 | L'éligibilité à la marge de préférence (candidat national, régional, sous-traitance ≥ 25 % à une PME locale) : quelle donnée de l'entreprise la porte ? | pilote, backend |
| Q9 | Les articles cités par le guide (loi n° 2016-055) et les textes d'application en vigueur sont-ils validés pour devenir des règles de l'application ? | juriste |

## Ce que le front fera, et quand

- **Dès B1 et B2 livrés** : écran `/procedure/:idDmc/evaluation` (espace CAO et coquille interne), parcours par étapes et par lot ;
  déclaration préalable du membre ; grille de l'examen préliminaire pré-remplie, motif et clause obligatoires pour écarter ;
  demandes de précisions côté PRMP et réponses côté candidat (page de sa procédure).
- **Dès B3** : corrections proposées à retenir ou non, saisie du rabais, de la préférence et des critères, **tableau d'évaluation**
  du guide, classement.
- **Dès B4 et B5** : indicateurs de prix, demande et suivi des justifications, post-qualification critère par critère avec passage
  automatique au suivant.
- **Dès B6** : production, lecture et signature du rapport (sur le modèle de `signatures-pv.ts`), observations des membres.
- Entrées de menu : « Évaluation » sur la fiche (à côté de « Séance d'ouverture ») et dans « Mes procédures » de l'espace CAO ;
  compteurs du §B7.
