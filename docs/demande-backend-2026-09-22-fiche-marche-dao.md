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
| H7 | Une information reprise du PPM se corrige **dans le PPM** (nouvelle version) ; la fiche relit la version courante — ⚠️ 22/09 : « version courante » se lit par la **filiation de ligne** `ID_LIGNE_ORIGINE`, jamais par `ID_DETAIL` seul (précisé en B2, encadré « Identité de la ligne ») | rien dans ce lot |

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

> ⚠️ **22/09 — livraison backend (commit du lot), écarts sur B1 :**
> - **`controle` porte le rôle** : `REGLE` quand la règle ne lit que ce champ, **`REGLE:ROLE`** quand elle en lit plusieurs
>   (`VALIDITE_GARANTIE_SUP_OFFRE:GARANTIE` / `:OFFRE`, `DATES_ORDRE:REMISE` / `:OUVERTURE`, `AVANCE_SUP_5_GARANTIE:TAUX` /
>   `:GARANTIE`, `FORFAIT_60_40:RECEPTION` / `:PV`, `PENALITES_PLAFOND_15:TAUX` / `:DEROGATION`,
>   `INTERETS_MORATOIRES_TAUX:TAUX` / `:BANQUE`, `DELAI_PAIEMENT_75:DELAI`). Raison : la liste nominative des champs
>   n'est pas connue du code, c'est donc le champ qui nomme la règle **et sa place dans la règle** ; une règle dont un
>   rôle n'a pas encore de champ **attend** (ni bloquante, ni « ok ») — le référentiel se complète sans livraison.
>   Rôles et règles : `docs/api-endpoints.md`, § *Fiche marché*.
> - `condition` : évaluateur identique à celui du front (grammaire ci-dessous, clé absente ⇒ chaîne vide) ; une
>   expression **illisible est refusée en 400 `condition`** à l'écriture (Admin, import) — jamais une exception à
>   l'exécution pour la PRMP.
> - `LISTE` : `options[]` obligatoires (400 sinon) ; `PPM` exige `clePpm`, `CADRAGE` exige `cleCadrage` ; `rang` absent =
>   dérivé du code ; `documentMaitre` absent = `AUCUN`.
> - **Import** : CSV seulement (UTF-8, séparateur `;`, en-têtes = noms JSON des champs, listes séparées par des virgules
>   dans la cellule), lancé au démarrage par `app.fiche-marche.import-csv=<chemin>` ; création ou mise à jour par
>   `code`, lignes fautives rejetées avec leur raison dans le journal applicatif. Pas de XLSX au lot 1.
> - **`PIECE`** : le type existe au référentiel, mais une valeur `PIECE` est refusée en 400 sur `PUT …/blocs` (les pièces
>   relèvent du lot 2, avec `t_piece_jointe_dossier`).

> ⚠️ **22/09 — réponse au backend (« aucun évaluateur d'expressions dans le projet »)** : la grammaire de `condition`
> est volontairement **minuscule**, sans parenthèses ni priorité — une quinzaine de lignes, pas un moteur :
> 1. couper la chaîne sur ` ou ` (insensible à la casse, entouré d'espaces) → des groupes ; **un groupe vrai suffit** ;
> 2. couper chaque groupe sur ` et ` → des termes ; **tous les termes doivent être vrais** ;
> 3. un terme est `cle = VALEUR` ou `cle != VALEUR` (`^([A-Za-z_][A-Za-z0-9_]*)\s*(=|!=)\s*([A-Za-z0-9_]+)$`) ;
>    la clé se lit dans `cadrage`, **absente ⇒ chaîne vide** (donc `= X` faux, `!= X` vrai) ;
> 4. un terme illisible vaut **faux** (jamais une exception) ; `condition` `null` ou vide vaut **vrai**.
>
> Le front porte **le même évaluateur** (`features/prmp/fiche-marche/fiche-marche-modele.ts`, `evaluerCondition`) et
> ses tests ; à reproduire à l'identique côté serveur — cas de recette : `garantieSoumission = OUI` (vrai), `= NON`
> (faux), `!= NON` (vrai), `provenance = IMPORTEES et typePrix = UNITAIRES` (vrai), `provenance = NATIONAL ou typePrix
> = UNITAIRES` (vrai), `avance = OUI` sur clé absente (faux), `n'importe quoi` (faux, sans exception).
>
> ⚠️ **22/09, 3e passe backend — valeurs comparables limitées à `[A-Za-z0-9_]+`** : c'est voulu. Toutes les réponses de
> cadrage sont des **codes** (`OUI`/`NON`, `UNITAIRES`, `CONJOINT_OU_SOLIDAIRE`, `SOLIDAIRE_OBLIGATOIRE`…) ; les deux
> compléments numériques (`nbLots`, `tauxAvance`) se comparent comme **chaînes décimales** (`nbLots = 1`), sans
> inégalité — aucune condition du lot 1 n'en a besoin ; les seuils numériques sont des **règles B4**, pas des conditions.

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

> ⚠️ **22/09 — réponses au backend sur B2 (quatre points relevés par sa vérification)**
>
> **1. Identité de la ligne à travers les versions (H7 vs `t_dossier_mec.ID_DETAIL`).** Le DMC reste lié à
> l'`ID_DETAIL` de la ligne **au moment de sa création** (rien à migrer). La « version courante » se retrouve par la
> **filiation** livrée au versionnement du 05/08 : `t_marche.ID_LIGNE_ORIGINE`, appariement **jamais par position**.
> Ligne courante = dans la **dernière version signée** de la même filiation de dossiers (chaîne `REMPLACE`), la ligne
> dont l'`ID_LIGNE_ORIGINE` est celui de la ligne liée. Le `GET` sert alors `valeursPpm` et `versionPpm` **de la ligne
> courante**, plus `idDetailCourant` et `ligneSupprimee: boolean` (la filiation est supprimée logiquement dans la
> version courante : le front avertit, ne bloque pas au lot 1). `eligibles` ne liste que les lignes de la **dernière
> version signée** de chaque dossier ; `dejaDao` se calcule **sur la filiation** (un DMC lié à un ancêtre compte) ;
> `POST par-marche` sur la ligne d'une version dépassée → 409 « préparer depuis la version courante ». Test 9 récrit
> plus bas.
>
> ⚠️ **22/09, 3e passe backend — « dernière version signée » ≠ parcours `suivante` (l. 1243, qui n'écarte que
> `BROUILLON`)** : ne pas réutiliser ce parcours. Écrire un parcours **dédié** : suivre la chaîne `REMPLACE` → version
> suivante tant que la suivante est **signée** (même prédicat que la garde H4 : `PV_SIGNE` / `CLOTURE`, avis `FAV` ou
> `FAVR` réserves levées) ; une version encore **en instruction** n'est pas courante et **arrête** la marche sans
> devenir courante — la dernière signée le reste jusqu'à la signature de la suivante. Ainsi une mise à jour en cours
> d'examen ne fait jamais changer les 22 informations sous les pieds de la fiche.
>
> **2. Ordre des gardes, sans fuite d'information.** `POST par-marche/{idDetail}` : (1) ligne inexistante → 404 ;
> (2) **périmètre** (PRMP propriétaire ou son UGPM, ou Admin) → 403, **avant tout 409 métier** — une PRMP étrangère
> n'apprend jamais si une ligne porte déjà un DAO ; (3) **vacance** : `MandatService.exigerMandatActif`, même garde que
> `POST /api/saisies/dossier`, posée aussi sur `PUT …/cadrage`, `PUT …/blocs/{bloc}`, `POST …/valider`, `POST …/reviser`
> (un acte PRMP en vacance de mandat est refusé comme partout) ; (4) gardes H4 → 409 nominatifs. Le test existant
> `SecuriteCrudIntegrationTest` (l. 651-665, « PRMP → 403 sur par-marche ») **change de sens** : PRMP propriétaire
> → 201, autre PRMP → 403, Admin → 201 inchangé — c'est la demande, pas une régression.
>
> **3. Le type DMC `DAO` n'existe dans aucune migration.** ~~La migration du lot sème `t_type_dmc`~~ ⚠️ **corrigé le
> 22/09 (3e passe backend : un semis Flyway survit aux rollbacks `@Transactional` et casse neuf fixtures qui créent
> `DAO`, `CODE` étant unique)** → **pas de migration de données** : le code `DAO` est semé par un **seeder de démarrage
> idempotent**, sur le modèle des seeders existants (`DelegationHierarchieSeeder` : `CommandLineRunner`, « insérer si
> absent »), donc **hors du contexte de test** comme eux — les neuf fixtures ne changent pas. Test 11 récrit plus bas
> (le seeder, pas la migration). Le libellé semé : « Dossier d'appel d'offres ». Le rattachement mode de passation → type DMC reste **l'acte de
> l'Administrateur** (écran « Types de DMC », `dmc-mapping-admin`) ; seul le **jeu de recette** rattache le mode d'appel
> d'offres ouvert. Ligne dont le mode n'est rattaché à aucun type → 409 nominatif : « Le mode « … » n'est rattaché à
> aucun type de dossier de mise en concurrence — à faire par l'Administrateur (Types de DMC) ». Le code `DAO` du type
> DMC est **le même** que le sous-type `DAO` de la famille DMC (`sous-type-dossiers`) : le front entre par le sous-type,
> la garde lit le type.
>
> **4. `eligibles` attrapé par `/{id}`** : déclarer la route littérale avant la variable (Spring préfère le littéral) —
> déjà noté ci-dessus.

> ⚠️ **22/09 — livraison backend (commit du lot), précisions sur B2 telles que livrées :**
> - **Ordre des 409 H4** (après 404, 403 et vacance) : `LIGNE_RETIREE` → **`VERSION_DEPASSEE`** (le dossier de la ligne
>   est `REMPLACE` : « préparer l'appel d'offres depuis la version courante ») → `MODE_NON_DAO` (mode rattaché à aucun
>   type, message qui nomme l'Administrateur, ou à un type autre que `DAO` / inactif) → `PV_NON_SIGNE` → `DAO_EXISTANT`
>   (sur la **filiation**). Le code `VERSION_DEPASSEE` n'était pas nommé dans la demande.
> - **Parcours de la filiation** : la chaîne `REMPLACE` est suivie tant que la version suivante est **signée** (même
>   prédicat que H4) **ou elle-même déjà remplacée** (elle l'a donc été avant) ; une version en instruction arrête la
>   marche. Enfants triés par identifiant. Une ligne retirée reste lue (`ligneSupprimee = true`).
> - **`eligibles` par profil** : PRMP / UGPM = les lignes de ses plans ; **Président / Administrateur = toutes les
>   lignes éligibles** (vue de contrôle) ; tout autre profil = `[]` (200, pas 403). Les lignes `DAO_EXISTANT` restent
>   listées avec `dejaDao = true` et `idDmc` ; celles d'une version `REMPLACE` n'y sont jamais.
> - **`valeursPpm` du `POST`** : clé = **code du champ** `PPM` (`B01-AC-14`…), comme sur la fiche — pas la clé interne.
>   `versionPpm` = `NUM_MAJ`, **0** pour un plan initial (jamais `null`).
> - **Admin** : geste d'origine inchangé (400 mode non mappé, 409 `DAO_EXISTANT`), **sans** H4 ni valeurs relues.

### B3 — La fiche (`/api/fiches-marche`, `t_fiche_marche` + `t_fiche_marche_valeur`)

| | |
|---|---|
| Identité | une fiche **par DMC** (`idDmc`), créée au premier `PUT` ; `typeMarche` fixé par le cadrage |
| Statut | `BROUILLON` · `VALIDEE` (figée, H5/H1) ; `version` (1, 2… — une modification après validation ouvre une **nouvelle version** brouillon, l'ancienne reste lisible) |
| `cadrage` | réponses aux **dix questions** (clés : `typeMarche`, `alloti`, `nbLots`, `variantes`, `groupement`, `formeGroupement`, `provenance`, `typePrix`, `prixRevisable`, `garantieSoumission`, `avance`, `tauxAvance`, `penalites`, `attributaires` [contrat-cadre]) |
| `valeurs` | `{ code: valeur }` pour les champs `SAISIE` ; les `MONTANT` reçoivent le nombre, le serveur sert aussi **`enLettres`** : `{ code: texte }` dans `FicheMarcheDto` (« huit millions quatre cent mille ariary »), jamais calculé côté client |
| Accès | PRMP / UGPM propriétaire du dossier de planification ; lecture pour les contrôleurs du périmètre (403 sinon) |

| Méthode | URL | Corps | Réponse | Accès |
|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc} | — | `FicheMarcheDto` (idDmc, idDetail, idDossier, refeDossier, designationMarche, typeMarche, statut, version, cadrage, valeurs, `valeursPpm`, `versionPpm`, `enLettres`, `bilanControles`, dateValidation, validePar) | propriétaire, contrôleurs du périmètre |
| PUT | /api/fiches-marche/{idDmc}/cadrage | `{ cadrage }` | `FicheMarcheDto` | propriétaire (PRMP / UGPM) ; 409 si `VALIDEE` |
| PUT | /api/fiches-marche/{idDmc}/blocs/{bloc} | `{ valeurs }` du bloc | `FicheMarcheDto` | idem ; **400 nominatifs par champ** (`{ champ: code, message }[]`, comme les justifications) pour type, liste, obligatoire |
| POST | /api/fiches-marche/{idDmc}/controler | — | `BilanControlesDto` | idem |
| POST | /api/fiches-marche/{idDmc}/valider | — | `FicheMarcheDto` (VALIDEE, version n) | **PRMP seule** (H1) ; 409 si des contrôles bloquants restent |
| POST | /api/fiches-marche/{idDmc}/reviser | — | `FicheMarcheDto` (nouvelle version BROUILLON) | propriétaire |
| GET | /api/fiches-marche/{idDmc}/versions | — | versions figées (lecture) | idem lecture |

Un champ dont la **condition de cadrage** est fausse est **ignoré** à l'enregistrement et absent du bilan (rubrique
fermée). Les valeurs `CADRAGE` sont dérivées, jamais reçues.

> ⚠️ **22/09 — livraison backend (commit du lot), écarts sur B3 :**
> - **`obligatoire` n'est pas un 400 au `PUT`** : le 400 nominatif couvre ce qui est *illisible* (type, option de liste,
>   `MONTANT` négatif, `POURCENTAGE` hors 0–100, `DATE` mal formée, champ inconnu / inactif / d'un autre bloc / `PPM` /
>   `CADRAGE`, `PIECE`) ; un **obligatoire manquant est bloquant au bilan** (`OBLIGATOIRE`). Raison : on enregistre
>   un brouillon incomplet bloc par bloc, on ne le valide pas — un 400 empêcherait d'enregistrer une rubrique entamée.
> - **Écriture** (`cadrage`, `blocs`, `reviser`) : PRMP / UGPM propriétaires **et Administrateur** ; **validation** :
>   PRMP seule (403 UGPM et Admin). `POST …/controler` est ouvert à qui lit (contrôleurs du périmètre compris).
> - **409 à code stable** de la fiche : `DMC_NON_DAO` (le DMC n'est pas un DAO — sur toute route), `FICHE_VALIDEE`
>   (`PUT` ou `valider` sur une version validée), `FICHE_VIDE` (`valider` / `reviser` sans aucun enregistrement),
>   `BROUILLON_EN_COURS` (`reviser` alors que la dernière version est un brouillon), `CONTROLES_BLOQUANTS`,
>   `VACANCE_PRMP`.
> - **Cadrage** : clés admises = clés `cleCadrage` des champs `CADRAGE` du référentiel + `typeMarche` + `attributaires` ;
>   valeur typée par le champ reflet (`OUI`/`NON`, nombre, option) ; clé inconnue → 400 nominatif ; le `PUT` remplace
>   l'ensemble (clé absente = question sans réponse). **Lot 1 : `typeMarche` autre que `QUANTITE_FIXE` → 400.**
> - `enLettres` : livré par l'extension de `NombreEnLettres.cardinal` aux millions et milliards (PV et lettres en
>   profitent) ; au passage, « quatre cent**s** mille » (faux, produit par l'existant) devient « quatre cent mille ».

> ⚠️ **22/09 — `enLettres` (réponse au backend : `NombreEnLettres` plafonne à 999 999).** Les montants de marché en
> Ariary dépassent couramment le milliard : étendre le convertisseur aux **millions et milliards** (« huit millions
> quatre cent mille ariary », « un milliard deux cents millions ariary »), avec un test par palier (999 999 ·
> 1 000 000 · 1 000 001 · 999 999 999 · 1 000 000 000 · 1 200 000 000) et l'invariant « et un » / « et onze » / pluriels
> (« quatre-vingts », « deux cents ») déjà couverts par l'existant. Le texte sert aussi les PV et lettres : l'extension
> vaut pour tous.

### B4 — Contrôles (catalogue nommé, `BilanControlesDto`)

`{ bloquants: Controle[], avertissements: Controle[], ok: Controle[], nbSaisis, nbAttendus }` avec
`Controle = { regle, champs: code[], bloc, message }`. Règles de l'esquisse à livrer (quantité fixe) :

| Règle | Énoncé | Gravité |
|---|---|---|
| `OBLIGATOIRE` | champ obligatoire vide (rubrique ouverte) | bloquant |
| `DATES_ORDRE` | lancement < remise des offres < ouverture < attribution (PPM + B04) | bloquant |
| `VALIDITE_GARANTIE_SUP_OFFRE` | validité de la garantie de soumission > validité des offres | bloquant |
| `AVANCE_MAX_20` | ~~avance ≤ 20 % du montant TTC~~ ⚠️ 22/09 : **`tauxAvance` (cadrage, en %) ≤ 20** — il n'existe aucun montant TTC (arbitrage pilote du 18/09, `SeuilMarche` : tous les montants PRS sont **hors taxes**) ; la règle porte sur le **taux**, jamais sur un montant | bloquant |
| `AVANCE_SUP_5_GARANTIE` | ⚠️ 22/09 : **`tauxAvance` > 5 ⇒** le champ « garantie de restitution d'avance » (B08, rubrique Avance) renseigné | bloquant |
| `FORFAIT_60_40` | prix global forfaitaire : ≥ 60 % à réception, ≤ 40 % sur PV | bloquant |
| `PENALITES_PLAFOND_15` | pénalités > 15 % du CCAG sans dérogation précisée | avertissement |
| `INTERETS_MORATOIRES_TAUX` | taux ≥ taux Banque centrale + 1 point | avertissement |
| `DELAI_PAIEMENT_75` | délai de paiement ≤ 75 jours | avertissement |
| `MONTANT_POSITIF` | tout `MONTANT` > 0 | bloquant |

(Les règles « à commande » et « contrat-cadre » — minimum < maximum, durée ≤ 2 ans — viennent avec leurs lots.)
Le bilan est **recalculé à chaque `PUT`** et servi dans `FicheMarcheDto` ; `POST …/controler` le recalcule sans écrire.

> ⚠️ **22/09 — livraison backend (commit du lot), B4 tel que livré :** les dix règles du tableau sont dans le catalogue
> (`ControlesFicheMarche`). Chaque règle **trouve ses champs par leur `controle`** (`REGLE:ROLE`, cf. B1) :
> `DATES_ORDRE` lit `LANCEMENT` / `REMISE` / `OUVERTURE` / `ATTRIBUTION` et **replie sur les dates prévisionnelles du
> plan** (étapes CAPM « lancement » / « attribution ») pour les deux bornes que la fiche ne saisit pas ;
> `AVANCE_MAX_20` / `AVANCE_SUP_5_GARANTIE` lisent le rôle `TAUX` et, à défaut, **`tauxAvance` du cadrage** (et ne
> s'évaluent que si `avance = OUI`) ; `FORFAIT_60_40` ne s'évalue que si `typePrix = FORFAITAIRE` ; `MONTANT_POSITIF`
> s'applique à tout `MONTANT` saisi sans champ à déclarer. Une règle dont un rôle n'a pas encore de champ **n'est pas
> évaluée** (ni bloquante ni « ok ») : au jour de la livraison, seuls les champs `PPM` et `CADRAGE` sont semés — les
> règles de saisie attendent le fichier de correspondance (la recette les exerce sur des champs de test). `nbAttendus`
> compte les champs `SAISIE` des rubriques **ouvertes** (pas le `nbAttendu` des rubriques).

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

## Écarts de livraison constatés le 22/09 (implémentation backend en cours, lue sur son arbre de travail) — acceptés, front aligné

- **Rubrique** : `RubriqueDto` porte `nbAttendu` (pas « attendus ») et son `code` est **complet** (`B05-GS`) ; le champ porte
  `rubrique = "B05-GS"` aussi. Le front lit `nbAttendu` et compare les codes de rubrique complets ou courts indifféremment.
- **`FicheMarcheDto`** : `idFiche` (nul avant le premier enregistrement — fiche **virtuelle**, version 1, brouillon, servie en
  200 et non 404), `valeursCadrage` (champs `CADRAGE` dérivés, `{ code: valeur }`), `dateCreation`, `dateMaj` ; `valeurs`
  et `valeursPpm` en **chaînes** ; `dateValidation` en date-heure ISO. Le front affiche `valeursCadrage` en lecture.
- **`GET …/versions`** sert des **en-têtes** `VersionFicheDto` `{ idFiche, version, statut, typeMarche, dateCreation,
  dateValidation, validePar, nbValeurs }` ; le détail d'une version : **`GET …/versions/{numero}`** (route ajoutée).
- **`ChampFicheMarcheDto`** ajoute `cleCadrage` / `clePpm` (clés de dérivation) et écrit `rang` depuis le code ; pas d'`aide`.
- **409 de `POST par-marche`** à **codes stables** : `LIGNE_RETIREE`, `MODE_NON_DAO`, `PV_NON_SIGNE`, `DAO_EXISTANT`,
  `VACANCE_PRMP` ; la route littérale `/eligibles` est déclarée avant `/{id}`.
- **Type DMC `DAO`** : finalement semé par la **migration V35** (`INSERT … WHERE NOT EXISTS`, idempotent) et non par un
  seeder — le backend a préféré récrire les trois fixtures en collision en `findByCode("DAO").orElseThrow()`. Accepté :
  le résultat est le même (base neuve = `DAO` présent) et la suite de tests reste cohérente. Test 11 se lit « migration ».

**Recette réelle du 22/09 (front, commit backend 43d3b4c, JAR redémarré, V35 appliquée)** : parcours complet vert en
navigateur avec PRMP001 sur la ligne 00001/PPM-AGPM/CNM/2026 — 7 lignes éligibles après rattachement du mode « Appel
d'offres ouvert » au type DAO par ADMIN01, 22 informations du PPM reprises, cadrage enregistré, huit blocs enregistrés,
23 reprises, bilan 0/0 (le référentiel n'a encore aucun champ `SAISIE` : le fichier de correspondance n'est pas chargé),
validation → version 1 puis 2 figées, `reviser` → version 3 brouillon. **Un petit reste (B5, non bloquant)** :
`validePar` sert l'identifiant (`IMP001`) — servir aussi **`nomValidePar`** (nom affichable), le front l'affichera dès
qu'il sera là.

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
9. ⚠️ récrit le 22/09 — **filiation** : DMC créé sur la ligne L (version 1) ; mise à jour du PPM signée en version 2
   où L' (`ID_LIGNE_ORIGINE` = celui de L) change de montant → `GET` sert `versionPpm = 2`, `idDetailCourant = L'`,
   le nouveau montant ; L' est `dejaDao` dans `eligibles` ; `POST par-marche/{L}` (version dépassée) → 409 ; L
   supprimée logiquement en version 2 → `ligneSupprimee = true`, `GET` 200. **Version 3 soumise mais non signée**
   (en instruction) → `GET` sert toujours `versionPpm = 2` (la marche s'arrête avant une version non signée).
10. Ordre des gardes : PRMP étrangère sur une ligne qui porte déjà un DAO → **403** (jamais 409) ; PRMP propriétaire
    sans mandat actif → refus de vacance sur `POST par-marche` et sur `PUT …/blocs/B02`.
11. ⚠️ récrit le 22/09 — **seeder** : sur `t_type_dmc` vide, le seeder crée `DAO` ; lancé deux fois, une seule ligne
    (idempotent) ; les fixtures existantes qui créent `DAO` passent inchangées. Ligne dont le mode n'est rattaché à
    aucun type → 409 nominatif qui nomme l'Administrateur.
12. `enLettres` : 8 400 000 → « huit millions quatre cent mille ariary » ; 1 200 000 000 → « un milliard deux cents
    millions ariary ».

## Côté front (pour information, développé contre ce contrat)

Dans « Créer dossier › Dossier de mise en concurrence », le sous-type `DAO` ouvre le parcours à sept étapes de la
maquette `docs/maquette-2026-09-22-dmc-fiche-marche.html` : choix de la ligne éligible, cadrage, blocs dessinés depuis
le référentiel (rubriques fermées masquées, champs `PPM` verrouillés avec leur provenance, `MONTANT` avec les lettres
servies), panneau des contrôles, validation PRMP. Tant que le référentiel n'a pas ses champs, chaque rubrique affiche
son compte attendu — l'écran se recette avant la matière. **H3, second point d'entrée** : dans « Mes PPM & marchés »,
chaque PPM dont une ligne figure dans `eligibles` porte un bouton « Appel d'offres (n) » vers `/prmp/dao?dossier=` ;
`?ligne=` ouvre une ligne d'emblée. Les deux se taisent tant que `eligibles` n'est pas servi.
