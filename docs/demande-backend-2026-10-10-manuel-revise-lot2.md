# Demande backend — manuel de contrôle révisé pour l'application, lot 2 : délais, mode, bloquants, acte d'engagement (2026-10-10)

Origine : `docs/manuel-controle-revise-2026-10-10-application.md`, §21 (arbitrages du pilote du 10/10, second lot : Q6, Q1, Q13, H2). Suite
du lot 1 (`demande-backend-2026-10-10-manuel-revise-lot1.md`). Les neuf délais et les quinze bloquants viennent de la loi n° 2016-055 ; les
articles ont été relus dans le texte (version CNLEGIS). Ce qui existe déjà est nommé par son code serveur ; ce lot ne demande que les écarts.

## Hypothèses (à confirmer ou corriger)

- **H1** — Convention de décompte des délais : le jour de départ n'est pas compté ; la date limite tombe au plus tôt le 31e (46e, 11e…) jour.
  « Jours francs » et « jours ouvrables » suivent le calendrier des jours fériés déjà servi (`/api/jours-feries`).
- **H2** — Le « point de départ » d'un délai de publicité est la **date de publication déclarée** par la PRMP à l'impression de l'avis
  (`datePublication`) ; si plusieurs supports sont déclarés, la plus tardive (règle prudente du pilote). Q7 (site de l'ARMP) reste ouverte.
- **H3** — Le mode d'une procédure est le cadrage `modeRemise` de la fiche DAO (PAPIER / ELECTRONIQUE).

## B1 — Les neuf délais légaux (Q6) : règles bloquantes

Nouveau service **`DelaisLegaux`** (table en code, pas en base : valeurs légales), avec pour chaque délai : code, valeur, unité (jours,
jours francs, jours ouvrables), texte, point de départ, sens (minimum / maximum). Exposé en lecture par `GET /api/delais-legaux` pour
l'écran et pour le PV (valeur constatée). **Les autres délais** (AOR, DC/PI, AMI, contrat-cadre, délais aménagés 15 j…) deviennent des
**paramètres administrables** (`t_delai_parametre` : code, valeur, unité, texte, actif ; écran Délais), **signalés** et non bloquants
tant que le pilote ne les a pas confirmés (§21, tableau « à confirmer »).

| # | Règle | Où elle bloque | Refus |
|---|---|---|---|
| 1-2 | `B04-LR-03/04` (`B04-OV-02` T, `B04-CP-02` CC) − date de publication ≥ 30 j (AOO national) / 45 j (AOO international, mode « international » du plan) | validation de la fiche (contre la date de publication prévue : prévision LANCEMENT ou `B04-SE-17`) **et** impression de l'avis (contre `datePublication` saisie) | 409 `DELAI_PUBLICITE` `{ requis, constate, depart, limite }` |
| 3 | Questions des candidats recevables jusqu'à J−10 avant la date limite | **nouveau formulaire de questions** (voir B2) : fermeture automatique à J−10 | 409 `QUESTIONS_CLOSES` |
| 4 | Consultation ouverte (mode « consultation » du plan) : date limite − date d'affichage ≥ 10 j | validation de la fiche / impression de l'avis | 409 `DELAI_PUBLICITE` |
| 5 | Plan de passation : sans réponse de la Commission dans les 10 jours ouvrables du dépôt, **réputé approuvé** | planificateur quotidien : dossier DDP `SOUMIS`/`RECU`/`DISPATCHE` sans PV signé 10 j ouvrables après `DATE_SOUMISSION` ⇒ statut `REPUTE_APPROUVE`, journal, notification PRMP et Président ; la garde `PV_NON_SIGNE` de la création d'un DMC accepte ce statut | — (déblocage) |
| 6 | Signature du marché ≥ 10 jours francs après la plus tardive des **réceptions** de l'information par les non-retenus | **[existe]** : délai d'attente calculé de la plus tardive de l'information et de l'affichage. Écart : le pilote compte depuis la **réception** par chaque non-retenu (`LUE_LE` de chaque lettre, à défaut l'envoi + délai postal ?) — **à arbitrer** (QB1) | 409 `DELAI_ATTENTE` **[existe]** |
| 7 | Pièces fiscales (≤ 6 mois) et sociales (≤ 3 mois) à la date de notification de l'attribution ; dépôt sous 15 jours | **[existe]** : échéance de 15 j, retrait proposé. **À ajouter** : à la vérification d'une pièce, `DATE_DELIVRANCE` ≥ notification − 6 mois (fiscale) / − 3 mois (sociale), sinon non conforme d'office | 400 `PIECE_TROP_ANCIENNE` |
| 8 | Avis d'attribution envoyé ≤ 30 jours après la notification | **non bloquant** : alerte à J+20 (`ALERTE_AVIS_LE`, à confirmer qu'elle existe et à régler à J+20), tâche obligatoire avant la clôture du dossier de marché | — |
| 9 | Déclaration sans suite : avis de la Commission ≤ 5 jours de la saisine | **[existe]** : déclaration refusée sans avis favorable, alerte la veille. **À ajouter** : relance à J+5 (PRMP, Membre, Président) ; le blocage reste jusqu'à l'avis exprès | — |

## B2 — Questions des candidats avant la date limite (table n° 3, art. 35-II)

N'existe pas. Besoin : `t_question_candidat` (procédure, candidat, question, posée le, réponse, répondue le, publiée le) ; `POST
/api/procedures-en-ligne/{idDmc}/questions` (candidat connecté ayant retiré le dossier, refusé après J−10 : 409 `QUESTIONS_CLOSES`) ; `GET`
pour la PRMP et le responsable ; `POST …/questions/{id}/reponse` (PRMP) ; **la réponse est diffusée à tous les candidats ayant retiré le
dossier** (art. 35-II : « l'ensemble des candidats ayant retiré un DAO devra être destinataire des réponses »), notification + page de la
procédure ; les questions et réponses sont jointes au dossier de marché (pièce générée « Questions et réponses »).

## B3 — Mode de la procédure fixé à la création (Q1)

- `modeRemise` du cadrage devient **non modifiable** dès qu'une version de la fiche est validée (409 `MODE_FIGE`) ; la révision copie le mode.
- Exception « migration documentée » : geste d'administration `POST /api/fiches-marche/{idDmc}/migrer-mode` (motif obligatoire, journal,
  re-saisie contrôlée) — réservé à l'Administrateur, tracé.
- `PiecesExigees` : la condition « procédure en ligne » du lot 1 (B4) lit ce mode ; en PAPIER, les listes V95 restent entières.

## B4 — Les bloquants de la loi (Q13) : les écarts

| # | Écart | Besoin |
|---|---|---|
| 2 | DAO complet avant publication (art. 31) | impression de l'avis refusée tant que `DAO_COMPLET` de la version validée n'est pas produit (`DaoCompletService.assurer` synchrone à la validation, ou 409 `DAO_COMPLET_ABSENT` avec relance) |
| 4 | Rejet d'un dépôt hors délai horodaté et tracé (art. 44) | `t_offre_tentative` (procédure, candidat, lot, horodatage serveur, motif `DELAI_DEPASSE`) écrite à chaque refus de création, d'envoi de morceau ou de scellement ; servie dans le registre des dépôts (`GET …/depots`, section « tentatives refusées ») et dans le PV d'ouverture |
| 9 | Montant évalué jamais saisi à la main (art. 46-47) | **à arbitrer (QB2)** : aujourd'hui `PUT …/offres/{id}/montant` accepte un montant retenu différent de la correction calculée, avec motif. Le pilote exclut la saisie manuelle : ne garder que le choix entre les corrections proposées (`LETTRES_PREVALENT`, `PU_PREVAUT`) et le refus du candidat ; supprimer `montant` libre |
| 10 | Rejet pour prix anormal : demande écrite **et** réponse tracées (art. 48) | **[existe]** demande écrite exigée. **À confirmer (QB3)** : une échéance passée sans réponse vaut « réponse tracée » (manuel 2-III-C P20 : défaut de réponse = refus) ; sinon le rejet attend une réponse |
| 13 | Recours suspensifs paramétrables | paramètre `RECOURS_SUSPENSIFS` (défaut : `REVISION_ARMP`, `REFERE` — comme aujourd'hui) lu par `suspensif()` ; `REEXAMEN` activable |
| 14 | Approbation du marché avant notification (art. 54) | `t_attribution` : `APPROBATION_AUTORITE`, `APPROBATION_DATE`, pièce `APPROBATION` (`t_attribution_piece`) ; notification refusée sans approbation ni enregistrement : 409 `MARCHE_NON_APPROUVE` (l'enregistrement est déjà exigé) |
| 15 | Immutabilité des étapes closes | verrou d'écriture : toute écriture sur la séance, l'évaluation ou l'AMI d'une procédure dont le dossier de marché est **soumis** est refusée (409 `ETAPE_CLOSE`), hors reprise d'évaluation tracée (`t_attribution_reprise`) ; complète l'instantané du lot 1 (B5) |
| 1, 3, 5-8, 11-12 | — | **[existe]** ou couverts par B1 (n° 1, 3) et le lot 1 (n° 6 quorum) |

## B5 — Acte d'engagement déposé en ligne (H2)

- **Clause des DPAO** : ajouter aux gabarits `DPAO-F`, `DPAO-T`, `DPIC-PI`, `DPAC-CC` (section « Signature de l'offre ») : « La soumission par
  la plateforme, effectuée depuis le compte authentifié du candidat et scellée par celle-ci, vaut signature de l'offre et de l'acte
  d'engagement au sens de l'article 31 du Code. L'attributaire remet l'original signé de son acte d'engagement avant la signature du
  marché. » — rendue seulement en mode ELECTRONIQUE.
- **Pièce de l'attributaire** : nature `ACTE_ENGAGEMENT_ORIGINAL` dans `t_attribution_piece` (dépôt par l'attributaire ou la PRMP,
  vérification PRMP `CONFORME`), exigée **avant la signature du marché** : 409 `AE_ORIGINAL_MANQUANT` (comme `FISCALE` / `SOCIALE`).
- **Paramètre par procédure** `SIGNATURE_OFFRE` (`t_parametre_interne_procedure`) : `SCELLE_PLUS_ORIGINAL` (défaut) / `CERTIFIEE` (réservé ;
  sans effet tant que la certification n'est pas branchée).
- Le projet de marché (art. 3, pièces constitutives) cite « l'acte d'engagement original remis le … ».

## Questions au backend

| # | Question |
|---|---|
| QB1 | Délai n° 6 : le pilote décompte depuis la **réception** par chaque non-retenu. Dans l'application, la réception d'une lettre est sa première consultation (`LUE_LE`) ; un candidat qui ne consulte jamais bloquerait la signature. Proposition : départ = max(`LUE_LE` ; `ENVOYEE_LE` + n jours, n paramétrable, défaut 3) — à arbitrer avec le pilote. |
| QB2 | Bloquant n° 9 : supprimer la saisie libre du montant retenu (ne garder que les corrections proposées et le refus du candidat) ? Le pilote tranche. |
| QB3 | Bloquant n° 10 : une échéance passée sans réponse vaut-elle « réponse tracée » pour rejeter une offre anormale ? |
| QB4 | Délai n° 5 : le statut `REPUTE_APPROUVE` d'un plan doit-il empêcher la Commission de rendre ensuite un avis (ou l'avis tardif vaut-il observation) ? |

## Ce que le front fera, et quand

Après livraison : affichage des neuf délais (requis / constaté / départ) sur la fiche, l'avis, l'attribution et la DSS, avec les refus
nommés ; formulaire de questions côté candidat (fermé à J−10) et réponses diffusées ; mode de la procédure figé dans le cadrage ;
registre des tentatives refusées ; approbation du marché dans l'écran Attribution ; original de l'acte d'engagement dans les pièces de
l'attributaire ; paramètres `RECOURS_SUSPENSIFS`, `SIGNATURE_OFFRE`, délais paramétrables en administration ; manuel à deux colonnes.
