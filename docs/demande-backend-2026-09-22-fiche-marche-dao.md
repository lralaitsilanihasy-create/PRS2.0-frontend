# Demande backend — Fiche marché d'un appel d'offres (DAO) : référentiel de champs, fiche par DMC, cadrage, contrôles, validation (lot 1)

**Date** : 2026-09-22 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : proposition
`docs/proposition-2026-09-22-dmc-appel-offres-fiche-marche.md` (esquisse PDF du 22/09 fournie par le pilote — appel
d'offres, fournitures ; **décision pilote : formulaire à remplir, aucun import de PDF**). Le pilote a demandé la
suite (« j'attends la suite ») sans trancher les sept arbitrages : **les recommandations de la proposition sont prises
comme hypothèses**, nommées ici H1-H7 ; toute correction du pilote se reporte **en place** dans ce document.

**Périmètre du lot 1** : le type de marché **quantité fixe** (tronc commun des fournitures), **sans génération de
documents** (lot 2). Les blocs et rubriques sont ceux de l'esquisse ; **la liste nominative des 130 champs à saisir
n'est pas connue du front** (le PDF ne donne que les comptes par rubrique) : le référentiel est livré avec sa
STRUCTURE (blocs, rubriques, comptes attendus) et se **remplit depuis le fichier de correspondance** dès que le
service le fournit — un outil d'import, pas un endpoint.

## Hypothèses de travail (H1-H7, à confirmer ou corriger par le pilote)

| # | Hypothèse | Si le pilote corrige |
|---|---|---|
| H1 | Le DAO généré (lot 2) est en **Word** depuis les modèles officiels, PDF en plus pour la publication ; **l'UGPM prépare, la PRMP valide et soumet** | changer la garde de `valider` |
| H2 | La **fiche structurée** est le contenu contrôlé par la CNM (points de contrôle sur la fiche = lot 5) ; d'ici là, l'examen porte sur les documents générés joints | rien dans ce lot |
| H3 | Point d'entrée : « Créer dossier › Mise en concurrence › DAO » **et** raccourci depuis la ligne du PPM | rien dans ce lot |
| H4 | **Lignes éligibles** : ligne d'un PPM dont le PV est **signé** (avis favorable, ou réserves levées), **mode de passation mappé au type DMC `DAO`**, ligne **sans DAO** existant et non retirée | ajuster B2 |
| H5 | La fiche est un **brouillon serveur enregistré bloc par bloc** | ajuster B3 |
| H6 | Génération (lot 2) avant « à commande » (lot 3) | ordre des lots |
| H7 | Une information reprise du PPM se corrige **dans le PPM** (nouvelle version) ; la fiche relit la version courante | rien dans ce lot |

## Constat (vrai au 22/09)

- Un DMC est aujourd'hui un dossier **sans contenu** (`POST /api/saisies/dossier` : sous-type, entité, localité) plus
  des pièces PDF ; le DAO est un PDF joint que la Commission lit.
- `/api/dmcs` (`t_dossier_mec`, lot 3a) porte déjà **un DMC par ligne de marché**, typé par
  `tr_mode_passation.ID_TYPE_DMC`, statuts `A_PREPARER` / `ENGAGE`, **création réservée à l'Admin, aucun écran ne
  l'appelle**. C'est l'ancrage naturel de la fiche.
- Les 22 informations « du PPM » de l'esquisse existent déjà : entité contractante et PRMP (dossier), nature, mode,
  montant estimatif, financement (marché), service bénéficiaire et compte (`service-beneficiaires`), dates
  prévisionnelles (`marche-previsions` par CAPM). Rien à ressaisir.

## Demande

### B1 — Référentiel `champs-fiche-marche` (`t_champ_fiche_marche`, blocs et rubriques compris)

Une ligne par **information** du fichier de correspondance (esquisse, § « Structure d'une information »), rattachée
à une **rubrique**, elle-même rattachée à un **bloc**. Le front **dessine l'écran depuis ce référentiel** (comme la
grille de contrôle depuis `points-ctrl`) : ajouter un champ ou changer une condition ne recompile rien.

| Champ (JSON) | Type | Sens |
|---|---|---|
| code | string, PK métier | `B05-GS-02` (bloc, rubrique, rang) |
| bloc | string | `B01` … `B10` (B07 réservé au contrat-cadre) |
| rubrique | string | code de rubrique dans le bloc (`GS` = garantie de soumission) ; libellé via `rubriques` (voir plus bas) |
| rang | number | ordre d'affichage dans la rubrique |
| libelle | string | « Montant de la garantie de soumission » |
| type | string | `TEXTE` · `TEXTE_LONG` · `NOMBRE` · `MONTANT` (Ariary, chiffres **et lettres** générées) · `POURCENTAGE` · `DATE` · `LISTE` (avec `options[]`) · `OUI_NON` · `PIECE` |
| source | string | `PPM` (repris de la ligne, verrouillé) · `SAISIE` · `CADRAGE` (repris d'une réponse de cadrage) |
| documentMaitre | string | `DPAO` · `DPAC` · `AE` · `CCAP` · `AUCUN` (les « sans document ») |
| reprises | string[] | documents où l'information est reprise (`["AE","CCAP"]`) |
| typesMarche | string[] | `QUANTITE_FIXE` · `A_COMMANDE` · `CONTRAT_CADRE` |
| condition | string, nullable | expression sur le cadrage : `garantieSoumission = OUI`, `provenance = IMPORTEES`, `typePrix = UNITAIRES`… (grammaire : `cle = VALEUR`, `et`, `ou`) |
| obligatoire | boolean | |
| texteType | string, nullable | phrase d'insertion (« modèle de rédaction ») avec des `{code}` de champs |
| controle | string, nullable | nom d'une règle du catalogue B4 (`AVANCE_MAX_20`, `VALIDITE_GARANTIE_SUP_OFFRE`…) |
| actif | boolean | un champ écarté du fichier nettoyé reste dans l'historique |

**`GET /api/champs-fiche-marche?typeMarche=QUANTITE_FIXE`** (authentifié) → `{ blocs: BlocDto[], champs: ChampDto[] }`
avec `BlocDto = { code, libelle, rang, rubriques: [{ code, libelle, rang, documentMaitre? }] }`. Écriture : **Admin**
(`POST`/`PUT` d'un champ ; blocs et rubriques figés par migration). **Import** : outil de chargement depuis le fichier
de correspondance nettoyé (CSV/XLSX → référentiel), hors API.

**Blocs et rubriques à livrer par migration** (quantité fixe, comptes attendus de l'esquisse, entre parenthèses) :

- **B01** Identification & données du PPM — Acheteur (18 informations `PPM`, verrouillées).
- **B02** Objet, allotissement & forme du marché — Objet de l'appel d'offres (`PPM`), Lots et variantes (3 `PPM` + 3 à
  saisir), autres champs du bloc (4 à saisir, DPAO 10).
- **B03** Candidats : groupement, sous-traitance, qualifications — Groupement (3, DPAO → AE, CCAP), Capacité et
  qualifications des candidats (8, DPAO), Sous-traitance (2, AE → CCAP), Nantissement (2, AE → CCAP).
- **B04** Dossier, remise & ouverture des offres — Demande d'éclaircissement (3), Contenu des offres (1), Délai de
  validité des offres (1 → CCAP), Langue (2), Remise des offres – forme des plis (2), Lieu, date et heure de remise (4),
  Ouverture des plis (2) — tous DPAO.
- **B05** Prix, montants & garantie de soumission — Contenu et décomposition des prix (6, DPAO → AE, CCAP), Variation
  des prix (2, DPAO → CCAP), Monnaie (2, DPAO → CCAP), Garantie de soumission (6, DPAO → AE 1, CCAP 2), Type de prix
  (4, AE).
- **B06** Évaluation, attribution & notification — Évaluation des plis, relations candidats / PRMP (1, DPAO),
  Évaluation des offres, montant évalué (13, DPAO), Attribution et notification du marché (2, CCAP) ; 3 informations
  **sans document** (attribution, appel d'offres infructueux, notification) livrées `documentMaitre = AUCUN`.
- **B08** Paiements, avances & garanties financières — Paiements (4 AE ; 9 CCAP), Avance (2 AE ; 7 CCAP), Acompte (1),
  Intérêts moratoires (1), Garantie de bonne exécution (1), Retenue de garantie (1) ; 1 sans document (« trimestriellement »).
- **B09** Exécution du marché & livraison — Lieu de livraison (1, DPAO → AE, CCAP), Ordres de modification et avenants
  (1 AE ; 2 CCAP), Délai d'exécution (3, CCAP → AE), Pièces contractuelles (1), Protection du secret (3), Pénalités
  de retard (3), Matériels confiés (1), Stockage (1), Emballage (2), Responsabilité du transport (3), Livraison des
  fournitures (2), Assurance (2), Contrôle des prix de revient (1), Inspections, vérifications et essais (1), Décision
  après inspection (1), Délai de garantie (2) — CCAP.
- **B10** Modifications, résiliation & litiges — Indemnité de résiliation (2), Arbitrage (1), Dérogation aux documents
  généraux (1) — CCAP.

Tant que le fichier nettoyé n'est pas chargé, **les rubriques existent et les champs manquent** : le front affiche la
rubrique avec « n informations attendues, référentiel à compléter » — l'écran est vérifiable avant la matière.

### B2 — Créer la fiche depuis la ligne du PPM

- **`POST /api/dmcs/par-marche/{idDetail}`** ouvert à la **PRMP / UGPM propriétaire** du dossier de planification
  (aujourd'hui Admin seul) ; garde H4 : PPM au PV **signé** (`PV_SIGNE`/`CLOTURE`, avis `FAV` ou `FAVR` réserves
  levées), mode de la ligne **mappé au type DMC `DAO`** (409 nominatif sinon : « Le mode « … » n'est pas un appel
  d'offres »), ligne sans DAO (409 existant, comme aujourd'hui), non retirée. L'Admin garde son accès.
- **`GET /api/dmcs/eligibles`** (PRMP / UGPM) → les lignes de PPM éligibles du périmètre :
  `{ idDetail, idDossier, refeDossier, designationMarche, idMode, libelleMode, montEstim, dejaDao: boolean, idDmc? }`
  (`idDmc` quand `dejaDao`, pour rouvrir la fiche). ⚠️ Constaté le 22/09 sur l'existant : le segment `eligibles` est
  aujourd'hui attrapé par `GET /api/dmcs/{id}` et répond **400** (« eligibles » n'est pas un identifiant) — le front
  traite ce 400 comme « contrat absent », au même titre qu'un 404, tant que la route littérale n'est pas déclarée.
- La réponse du `POST` (et `GET /api/fiches-marche/{idDmc}`) porte **`valeursPpm`** : les 22 informations reprises,
  clé = `code` du champ `source = PPM` (B01 et B02), valeur telle qu'affichée, plus `versionPpm` (numéro de version du
  PPM lu) — H7 : relues à chaque `GET`, jamais stockées dans la fiche.

### B3 — La fiche (`/api/fiches-marche`, `t_fiche_marche` + `t_fiche_marche_valeur`)

| | |
|---|---|
| Identité | une fiche **par DMC** (`idDmc`), créée au premier `PUT` ; `typeMarche` fixé par le cadrage |
| Statut | `BROUILLON` · `VALIDEE` (figée, H5/H1) ; `version` (1, 2… — une modification après validation ouvre une **nouvelle version** brouillon, l'ancienne reste lisible) |
| `cadrage` | réponses aux **dix questions** (clés : `typeMarche`, `alloti`, `nbLots`, `variantes`, `groupement`, `formeGroupement`, `provenance`, `typePrix`, `prixRevisable`, `garantieSoumission`, `avance`, `tauxAvance`, `penalites`, `attributaires` [contrat-cadre]) |
| `valeurs` | `{ code: valeur }` pour les champs `SAISIE` ; les `MONTANT` reçoivent le nombre, le serveur sert aussi `enLettres` |
| Accès | PRMP / UGPM propriétaire du dossier de planification ; lecture pour les contrôleurs du périmètre (403 sinon) |

| Méthode | URL | Corps | Réponse | Accès |
|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc} | — | `FicheMarcheDto` (cadrage, valeurs, `valeursPpm`, `versionPpm`, `bilanControles`, statut, version) | propriétaire, contrôleurs du périmètre |
| PUT | /api/fiches-marche/{idDmc}/cadrage | `{ cadrage }` | `FicheMarcheDto` | propriétaire (PRMP / UGPM) ; 409 si `VALIDEE` |
| PUT | /api/fiches-marche/{idDmc}/blocs/{bloc} | `{ valeurs }` du bloc | `FicheMarcheDto` | idem ; **400 nominatifs par champ** (`{ champ: code, message }[]`, comme les justifications) pour type, liste, obligatoire |
| POST | /api/fiches-marche/{idDmc}/controler | — | `BilanControlesDto` | idem |
| POST | /api/fiches-marche/{idDmc}/valider | — | `FicheMarcheDto` (VALIDEE, version n) | **PRMP seule** (H1) ; 409 si des contrôles bloquants restent |
| POST | /api/fiches-marche/{idDmc}/reviser | — | `FicheMarcheDto` (nouvelle version BROUILLON) | propriétaire |
| GET | /api/fiches-marche/{idDmc}/versions | — | versions figées (lecture) | idem lecture |

Un champ dont la **condition de cadrage** est fausse est **ignoré** à l'enregistrement et absent du bilan (rubrique
fermée). Les valeurs `CADRAGE` sont dérivées, jamais reçues.

### B4 — Contrôles (catalogue nommé, `BilanControlesDto`)

`{ bloquants: Controle[], avertissements: Controle[], ok: Controle[], nbSaisis, nbAttendus }` avec
`Controle = { regle, champs: code[], bloc, message }`. Règles de l'esquisse à livrer (quantité fixe) :

| Règle | Énoncé | Gravité |
|---|---|---|
| `OBLIGATOIRE` | champ obligatoire vide (rubrique ouverte) | bloquant |
| `DATES_ORDRE` | lancement < remise des offres < ouverture < attribution (PPM + B04) | bloquant |
| `VALIDITE_GARANTIE_SUP_OFFRE` | validité de la garantie de soumission > validité des offres | bloquant |
| `AVANCE_MAX_20` | avance ≤ 20 % du montant TTC | bloquant |
| `AVANCE_SUP_5_GARANTIE` | avance > 5 % ⇒ garantie de restitution renseignée | bloquant |
| `FORFAIT_60_40` | prix global forfaitaire : ≥ 60 % à réception, ≤ 40 % sur PV | bloquant |
| `PENALITES_PLAFOND_15` | pénalités > 15 % du CCAG sans dérogation précisée | avertissement |
| `INTERETS_MORATOIRES_TAUX` | taux ≥ taux Banque centrale + 1 point | avertissement |
| `DELAI_PAIEMENT_75` | délai de paiement ≤ 75 jours | avertissement |
| `MONTANT_POSITIF` | tout `MONTANT` > 0 | bloquant |

(Les règles « à commande » et « contrat-cadre » — minimum < maximum, durée ≤ 2 ans — viennent avec leurs lots.)
Le bilan est **recalculé à chaque `PUT`** et servi dans `FicheMarcheDto` ; `POST …/controler` le recalcule sans écrire.

### B5 — Validation et versions

`valider` : tous les bloquants levés → statut `VALIDEE`, `version` figée, horodatage et auteur ; **journal** du
dossier de planification : `FICHE_MARCHE_VALIDEE` (détail « DAO, version n, N informations »). `reviser` : nouvelle
version `BROUILLON` copiée de la dernière validée. La génération des documents et leur jointure au dossier sont le
**lot 2** ; la **soumission** à la CNM reste le geste existant du dossier DMC (`POST /api/saisies/dossier` puis
soumission), auquel le lot 2 rattachera les documents.

### B6 — Journal, notifications, chronométrage

Aucune notification dans ce lot (geste propre à la PRMP / UGPM). Journal : `FICHE_MARCHE_VALIDEE` seulement (rang
d'un acte PRMP). Chronométrage : sans objet avant soumission.

### Options écartées

- *Stocker les 22 informations dans la fiche* : elles vivraient une seconde fois et divergeraient du PPM (H7).
- *Un formulaire codé en dur* : 130 champs, trois types de marché et un fichier encore en évolution (125 points
  ouverts) — seul un référentiel serveur tient.
- *Importer un DAO PDF* : écarté par le pilote (formulaire).

## Tests attendus (recette backend)

1. Référentiel : `GET ?typeMarche=QUANTITE_FIXE` sert 9 blocs (B01-B06, B08-B10), leurs rubriques dans l'ordre, et
   les champs chargés ; `?typeMarche=A_COMMANDE` ajoute les champs propres (vides tant que non chargés).
2. PRMP crée le DMC d'une ligne éligible → 201, `valeursPpm` à 22 clés ; ligne d'un PPM non signé → 409 nominatif ;
   mode non mappé `DAO` → 409 ; seconde création → 409 ; UGPM de la PRMP → 201 ; autre PRMP → 403.
3. `eligibles` : ne liste que les lignes H4 du périmètre, `dejaDao` juste.
4. Cadrage `garantieSoumission = NON` → les champs de la rubrique GS sont ignorés au `PUT` et absents du bilan ;
   `= OUI` → obligatoires bloquants.
5. `PUT blocs/B05` avec un `MONTANT` négatif → 400 nominatif `{ champ: "B05-GS-02" }` ; type `DATE` mal formé → 400.
6. Bilan : `VALIDITE_GARANTIE_SUP_OFFRE` et `DATES_ORDRE` détectés ; `valider` avec un bloquant → 409 ; sans → 200,
   `VALIDEE` version 1, journal +1.
7. `reviser` → version 2 `BROUILLON`, version 1 lisible dans `versions` ; `PUT` sur une version `VALIDEE` → 409.
8. Contrôleur de la localité : `GET` 200 ; PRMP d'un autre périmètre : 403.
9. `valeursPpm` suit une nouvelle version du PPM (`versionPpm` change, valeurs relues).

## Côté front (pour information, développé contre ce contrat)

Dans « Créer dossier › Dossier de mise en concurrence », le sous-type `DAO` ouvre le parcours à sept étapes de la
maquette `docs/maquette-2026-09-22-dmc-fiche-marche.html` : choix de la ligne éligible, cadrage, blocs dessinés depuis
le référentiel (rubriques fermées masquées, champs `PPM` verrouillés avec leur provenance, `MONTANT` avec les lettres
servies), panneau des contrôles, validation PRMP. Tant que le référentiel n'a pas ses champs, chaque rubrique affiche
son compte attendu — l'écran se recette avant la matière.
