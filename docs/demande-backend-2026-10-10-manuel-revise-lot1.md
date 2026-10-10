# Demande backend — manuel de contrôle révisé pour l'application, lot 1 (2026-10-10)

Origine : `docs/manuel-controle-revise-2026-10-10-application.md` (révision du manuel : pièces remplacées par les écrans, contrôles
automatiques, règles de saisie) et les **arbitrages du pilote du 10/10** consignés à son §20 (Q2/Q14, Q3, Q4, Q5). Ce lot ne porte que ce
qui est tranché ; les délais minimaux (Q6, table à recevoir), le périmètre (Q1), la liste des bloquants (Q13) et les autres questions
du §19 viendront dans un lot 2.

Rien n'est à inventer : chaque besoin renvoie au point du manuel (section-Pn) qu'il sert.

## Hypothèses (à confirmer ou corriger)

- **H1** — Tout ce qui suit vaut pour une **procédure conduite dans l'application** (plan en données, fiche DAO validée, remise
  électronique, évaluation et attribution en ligne). En mode papier, les pièces restent exigées et rien ne change (Q1 en attente ;
  le retrait d'une pièce est donc **conditionné** : `t_dossier.ID_DMC` non nul, ou attribution en ligne pour un dossier de marché).
- **H2** — L'acte d'engagement du candidat dans une offre déposée en ligne est tenu pour signé par le **dépôt scellé authentifié**
  (pas de signature certifiée exigée). Le pilote doit le confirmer (il a réservé la signature manuscrite ou certifiée aux « actes
  engageants » : marché, avenant, décisions, accord des parties).
- **H3** — Le « représentant » du président de la CAO est un membre désigné par le président dans l'écran CAO (champ à créer, B2) ;
  à défaut de désignation, le président lui-même est obligatoire.

## B1 — Rapport et PV de validation fusionnés : la section « Séance de validation » (Q4)

Manuel : 2-II-F P12-P13, 2-III-C P13-P14, 2-III-E P6-P7 et P13-P14. Le rapport signé par la CAO **vaut PV de validation** ; les pièces
`PV_VALIDATION_CAO`, `PV_VALID_TECHNIQUE`, `PV_VALID_FINALE` et la partie « validation » de `PV_AMI` ne sont plus exigées (B4).

Chaque rapport produit par le serveur — rapport de présélection de l'AMI, rapport d'évaluation (fournitures, travaux, services), rapport
des propositions PI — porte, **générée**, une section « Séance de validation » :
- date et heure de la validation = dernière signature (`SIGNE_LE` / `LISTE_DEFINITIVE_LE`) ;
- membres de la CAO ayant validé (signataires, dans l'ordre), empêchements constatés (par qui, motif), membres en conflit d'intérêts
  exclus de la signature ;
- **quorum** : règle appliquée (B2), nombre de signataires requis et obtenus, « atteint » ;
- observations de désaccord portées à la signature (`t_evaluation_signature.OBSERVATION`).

Le rapport est **régénéré à la dernière signature** (c'est déjà le cas) : la section apparaît dans le PDF et le Word joints d'office.
Pour la PI, la même section est produite pour l'**arrêt technique** (validation du rapport technique par le président : date, auteur,
observation — `t_evaluation_technique`) dans la section 4 du rapport final.

## B2 — Quorum de la CAO paramétrable (Q5)

Manuel : tous les points « quorum et qualité des signataires » (2-II-F P10, P13 ; 2-II-G-2 P10 ; 2-III-C P3, P14 ; 2-III-E P3, P7, P8,
P14 ; 2-IV P11). Aujourd'hui, seul le quorum cryptographique des parts de clé est vérifié.

- Nouveau paramètre d'administration **`CAO_QUORUM`** (`t_parametre`, écran Nomenclatures/Paramètres) : règle `MAJORITE` (défaut :
  plus de la moitié des membres désignés de qualité `MEMBRE`), ou `TOUS`, ou un nombre entier minimal. Le **président ou son
  représentant** (H3) est toujours requis en plus du nombre.
- **Où il s'applique**, et il est **bloquant** :
  1. séance d'ouverture : la clôture (`POST …/seance/pv` puis signatures) est refusée tant que les signataires présents n'atteignent pas
     le quorum — 409 `QUORUM_NON_ATTEINT` avec `{ requis, obtenus, presidentSigne }` ;
  2. séance financière PI : idem — ce qui suppose **les signatures électroniques de la séance financière** (table `t_seance_financiere_signature`
     sur le modèle de `t_seance_signature`, gestes signer / empêchement, PV régénéré à chaque signature) ; manuel 2-III-E P8 ;
  3. rapports (B1) : la dernière signature ne clôt l'évaluation (ou n'arrête la liste de l'AMI) que si le quorum est atteint parmi les
     signataires non empêchés — sinon le rapport reste « à signer » et le président est notifié.
- **Lecture** : `SeanceDto.pv`, `EvaluationDto.rapport`, `PreselectionDto` exposent `quorum: { regle, requis, obtenus, atteint,
  presidentRequis, presidentSigne }` ; la valeur constatée est écrite dans le PV et la section « Séance de validation ».
- **Qualité des signataires** : le serveur garantit déjà que seuls les membres de la CAO signent ; il expose en plus, dans les mêmes DTO,
  la liste `signatairesAttendus[]` avec leur qualité (président, membre, représentant) pour l'écran du contrôleur.

## B3 — Documents générés à la place des imprimés SIGMP : double mode transitoire (Q3)

Manuel : 2-II-A/B P11-P12, 2-II-D pièce 5, 2-II-F P16-P17, 2-I pièce 2.

- Paramètre **`SIGMP_FIN_TRANSITION`** (date). Tant qu'elle n'est pas atteinte : les pièces `AVIS_SPECIFIQUE`, `LETTRE_INVITATION` et
  l'« imprimé SIGMP du projet d'AGPM/PPM » restent **acceptées mais facultatives** (`OBLIGATOIRE = false` dans `t_piece_sous_type`,
  sous la condition H1) ; après : **retirées** (B4).
- Paramètre **`SIGMP_DECISION_EQUIVALENCE`** (référence et date de la décision formelle, hors application) : porté au pied des documents
  générés (avis, lettres, AGPM dérivé) : « Document produit par la plateforme PRS 2.0 en application de la décision n° … du … ». Tant
  que le paramètre est vide, le pied dit « Projet — équivalence SIGMP en attente ».
- **Mentions complètes** : le backend vérifie, gabarit par gabarit (`AVIS-F`, `AVIS-T`, `LETTRE-PI`), que chaque mention du modèle type
  y figure (2-II-A P11 : objet, nombre de lots maximum par candidat, forme des prix, adresse de consultation et d'achat, date et heure
  limite et heure d'ouverture, coût du DAO et trois formes de paiement, adresse de l'agent comptable, trois formes de garantie et
  montant ; travaux : visites des lieux et réunions préparatoires ; lettre PI : liste des candidats, mode de sélection) et nomme les
  écarts dans sa réponse. Le front fera la même relecture sur les PDF.
- **Projet dès la fiche** : l'avis et la lettre sont aujourd'hui produits **après** le PV favorable. Le manuel exige le *projet* d'avis au
  dépôt du DAO. Besoin : `GET /api/fiches-marche/{idDmc}/avis-specifique/projet[?format=docx]` (et `…/lettres-invitation/projet`) rendu
  depuis la version validée **sans** passer la ligne à « Lancé », sans publication, avec le filigrane « PROJET ». Le dossier DMC le reçoit
  comme pièce `AVIS_SPECIFIQUE` jointe d'office (comme le DAO complet) à la création et à chaque nouvelle version.
- **Lettre d'invitation AOR** : la lettre n'existe que pour la PI ; l'appel d'offres restreint (DAOR/DAORI, MAOR/MAORI) en a besoin (2-II-D
  pièce 5, 2-III-D pièce 3). Gabarit `LETTRE-AOR` à produire sur le même service (`LettreInvitationService`), candidats saisis
  (`SOURCE = SAISIE`), sans AMI.

## B4 — Pièces retirées des listes par sous-type (Q2/Q14, Q4) — sous la condition H1

`t_piece_sous_type` (V95) : les lignes suivantes passent **`OBLIGATOIRE = false`** et sont **masquées** quand la condition « procédure en
ligne » tient (nouvelle colonne `CONDITION_LIGNE` ou règle dans `PiecesExigees.vaut()` : `ID_DMC` non nul / attribution en ligne) ; elles
restent exigées en mode papier.

| Code | Sous-types | Pourquoi (manuel §20) |
|---|---|---|
| `FICHE_PRESENTATION` | DAOO*, DAOR*, DC, MAOO*, MAOR*, MPI, DSS | validation tracée = signature ; données de la fiche / de l'attribution / de la demande |
| `AGPM_CONTROLE`, `PPM_CONTROLE` | tous | plan en données, PV signé ; un DMC ne se crée pas sans PV favorable |
| `PV_CNM_DMC`, `PV_CNM_MARCHE` | MAOO*, MAOR*, MPI ; AVN, DR, INDEMN, PENAL, SURSIS | PV signés de la Commission |
| `PV_VALIDATION_CAO`, `PV_VALID_TECHNIQUE`, `PV_VALID_FINALE` | MAOO*, MAOR*, MPI | rapport = PV (B1) |
| `PV_AMI` | DC | partie « validation » couverte par B1 ; partie « ouverture » **à confirmer (Q8)** — tant que Q8 est ouverte, la pièce reste exigée |
| `MARCHE_INITIAL` | AVN, DR, INDEMN, PENAL, SURSIS | **seulement si le marché est en ligne** : le scan signé est déjà dans `t_attribution_piece` (nature `MARCHE_SIGNE`) — le joindre d'office à l'acte, avec les avenants antérieurs ; en MGG ou marché saisi : reste exigé |
| `AVIS_SPECIFIQUE`, `LETTRE_INVITATION` | DAOO*, DPREQUAL, DAOR*, DC | B3 : facultatives pendant la transition, puis retirées |

`PV_OUVERTURE`, `RAPPORT_ANALYSE`, `RAPPORT_PRESELECTION`, `DAO_COMPLET`, `CAHIER_CHARGES`, `DEVIS_ESTIMATIF`, `PROJET_MARCHE`,
`MOTIFS_SANS_SUITE` sont déjà jointes d'office : rien à changer, sinon ne plus les présenter à la PRMP comme « à joindre ».

Garde : pour un acte de gestion, exiger que le marché soit **signé** dans l'application (`t_attribution.SIGNE_LE` non nul) quand il est
en ligne — 409 `MARCHE_NON_SIGNE` (manuel 2-IV D2 ; aujourd'hui seul le PV favorable est exigé).

## B5 — Ce que le contrôleur voit : l'instantané à la soumission et l'accès des profils CNM

Toute pièce retirée n'a de sens que si le Membre peut **lire les données figées** à la place. Aujourd'hui les lectures de la séance, de
l'évaluation, de l'AMI et de l'attribution sont réservées à la CAO, au responsable, à la PRMP et à l'UGPM (`exigerLecteur`), et rien
n'est figé à la soumission hors la version de la fiche.

- **Instantané** : à la soumission d'un dossier (et à chaque resoumission), le serveur écrit `t_dossier_instantane` (dossier, n° de
  soumission, écran — `SEANCE`, `EVALUATION`, `AMI`, `ATTRIBUTION`, `CAO`, `AVIS`, `PLAN`, `ACTE`, `DSS` —, JSON du DTO de lecture tel que
  servi à cet instant, empreinte SHA-256, date). Immuable (comme `t_version_dossier`). Pour un dossier de marché : `SEANCE`, `EVALUATION`,
  `ATTRIBUTION`, `CAO`, `AVIS`, `PLAN` ; pour un DMC : `PLAN`, `AVIS` (projet), `AMI` (DC), `CAO` ; pour un acte : `ATTRIBUTION`, `ACTE` ; DSS :
  `DSS`, `ATTRIBUTION`.
- **Lecture** : `GET /api/dossiers/{id}/instantanes` (liste) et `GET /api/dossiers/{id}/instantanes/{ecran}[?soumission=n]` → le JSON figé,
  ouverts aux profils CNM (Membre, CC, Président, Vérificateur, Assistant) **et** aux lecteurs actuels. Le front rend chaque écran en
  lecture seule depuis ce JSON (mêmes composants que les écrans vivants, en mode figé, bandeau « Figé à la soumission du … »).
- **Export PDF** d'un instantané : `GET …/instantanes/{ecran}/pdf` (moteur `DocumentLibre`), pour l'archivage avec le PV.

## B6 — Les contrôles automatiques et leurs résultats

Le manuel révisé classe ~160 contrôles en « automatique ». Ce lot ne demande que le **socle** ; les règles elles-mêmes (délais Q6,
bloquants Q13) viendront avec le lot 2.

- `t_controle_resultat` : dossier, n° de soumission, référence du manuel (section, page, Pn) ou point de grille, règle (code), valeurs
  constatées (JSON), résultat (`CONFORME` / `NON_CONFORME` / `NON_APPLICABLE`), bloquant (bool), auteur (`SERVEUR` ou matricule), date,
  observation (obligatoire si non conforme par un contrôleur).
- Exécution dans `DossierService.soumettre` : les contrôles **bloquants** avant la création de la réception (400 avec la liste des
  non-conformités et leurs valeurs : la PRMP sait quoi corriger) ; les **signalés** après, enregistrés. Rejoués à chaque resoumission.
- Lecture : `GET /api/dossiers/{id}/controles[?soumission=n]` (profils CNM, PRMP) ; écriture des contrôles B par le Membre :
  `POST /api/dossiers/{id}/controles` (point, résultat, observation), avec la même garde que `t_examen_detail`.
- Le PV de la Commission reprend, en annexe générée, la synthèse des contrôles (automatiques et manuels) ; `validerCoherenceAvis`
  tient compte d'un contrôle automatique non conforme non levé (avis FAV refusé).
- Premier contrôle à brancher sur ce socle, déjà entièrement tranché : **2-III-A P5** « documents d'évaluation signés » (PV d'ouverture
  signé, rapport signé avec quorum) et **2-III-C P3 / P14** (quorum, président, empêchements) — valeurs lues dans B2.

## Questions au backend

| # | Question |
|---|---|
| QB1 | Forme de l'instantané : un JSON par écran (proposé) ou une seule structure par dossier ? Taille attendue (une évaluation à 20 offres) ? |
| QB2 | Le représentant du président (H3) : champ sur `t_cao_membre` (`REPRESENTANT_PRESIDENT`) ou désignation par séance ? |
| QB3 | `CAO_QUORUM` : global, ou surchargeable par procédure dans les paramètres internes (`t_parametre_interne_procedure`) ? |

## Ce que le front fera, et quand

Après livraison : mode « figé » des écrans Séance, Évaluation, AMI, Attribution, CAO, Avis pour les profils CNM (depuis les instantanés),
bandeau et export PDF ; affichage du quorum (requis / obtenus / président) dans les écrans de séance et de rapport ; synthèse des
contrôles en tête de l'examen (lecture seule) et saisie des contrôles B avec observation ; retrait des pièces de l'onglet « Pièces »
selon les listes servies ; relecture des mentions des avis et lettres (B3).
