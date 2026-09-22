# Proposition — Dossier de mise en concurrence « appel d'offres » : la fiche marché, saisie unique, documents générés

**Date** : 2026-09-22 · **Auteur** : frontend (`frontendprs2`) · **Statut** : PROPOSITION à arbitrer par le pilote,
puis à transformer en demande backend. ⚠️ Rien de ce qui suit n'est codé ; le contrat esquissé au §6 est une
**proposition**, pas une description du backend.

**Origine** : « on veut continuer avec la création de dossier de mise en concurrence » (pilote, 22/09), avec pour
source l'**« Esquisse de conception du DAO par type de marché »** (PDF, 14 pages, 22/09/2026), établie à partir du
fichier de correspondance « DAO Fournitures et Services ». ⚠️ **Le PDF ne couvre que l'appel d'offres** (DAO) — pas
la consultation de prix ni le bon de commande — et seulement les **fournitures**, en trois types de marché :
quantité fixe, à commande, contrat-cadre. **Maquette** : `docs/maquette-2026-09-22-dmc-fiche-marche.html`.

## 1. Ce que dit l'esquisse (résumé fidèle)

- **Une source unique** : chaque information est saisie **une seule fois** dans une **fiche marché** organisée en
  blocs (B01 identification et données du PPM … B10 modifications, résiliation, litiges). Le **DPAO** (DPAC pour le
  contrat-cadre), l'**acte d'engagement** (AE) et le **CCAP** sont **générés** depuis la fiche, puis **assemblés**
  avec les parties standard du dossier type (avis d'appel d'offres, instructions aux candidats, CCAG,
  spécifications, bordereau, formulaires).
- **22 informations viennent du PPM**, reprises telles quelles et verrouillées (autorité contractante, PRMP,
  adresse, nature, montant estimatif, mode de passation, financement, service bénéficiaire, compte, dates
  prévisionnelles).
- **Un questionnaire de cadrage** (type de marché, allotissement, variantes, groupement, provenance des
  fournitures, type de prix, prix ferme ou révisable, garantie de soumission, avance, pénalités, mono ou multi
  attributaire) **ouvre ou ferme des rubriques entières**, ce qui supprime les mentions « choisir et supprimer les
  mentions inutiles » des documents.
- **Sept étapes** : créer depuis la ligne du PPM → cadrage → saisie bloc par bloc → reprises automatiques →
  contrôles (obligatoires, dates, montants, plafonds réglementaires) → validation par la PRMP (fiche **figée et
  versionnée**) → génération et assemblage.
- **Volumes** : quantité fixe 158 informations (22 PPM + 130 à saisir + 4 sans document), à commande 165,
  contrat-cadre 182 — dont **74 sans document** et un **CCAP vide** pour le contrat-cadre (répartition proposée,
  à valider). Chaque information devient une **fiche champ** (identifiant, libellé, bloc et rubrique, type de
  donnée, source, document maître, documents de reprise, types de marché, condition d'affichage, obligatoire,
  texte type, contrôle) — cinq de ces attributs restent **à ajouter** au fichier.
- **Six décisions avant de construire** : CCAP du contrat-cadre ; 74 informations sans document ; 125 points
  ouverts du fichier ; codes manquants (attribution, appel infructueux, notification, trimestriel) ; format de
  sortie (Word, PDF, les deux) ; rôles (qui remplit, relit, valide, fige).

## 2. Ce qui existe déjà dans PRS 2.0 (à ne pas réinventer)

| Brique | Aujourd'hui | Ce que l'esquisse en fait |
|---|---|---|
| **Créer dossier › Dossier de mise en concurrence** (`soumettre-dossier.ts`) | un sous-type choisi (référentiel `sous-type-dossiers`, famille DMC : `DAO`, `DAOR`…), une entité, une localité, les **pièces jointes** attendues de la famille ; le dossier est **sans contenu** (`POST /api/saisies/dossier`) ; le DAO lui-même est **un PDF joint** | devient le point d'entrée du parcours : le sous-type `DAO` ouvre la **fiche marché** ; les autres sous-types gardent le flux actuel |
| **DMC par ligne de marché** (`/api/dmcs`, `t_dossier_mec`, lot 3a du 26/08) | **un DMC par ligne du PPM** (`idDetail`), **type dérivé du mode de passation** (`tr_mode_passation.ID_TYPE_DMC` → `DAO`, `DC`, `BC`…), statuts `A_PREPARER` / `ENGAGE`, création réservée à l'Admin, **aucun écran ne l'appelle** | c'est exactement l'étape 1 de l'esquisse (« créer le dossier depuis le PPM ») : le DMC rattache la fiche à sa ligne de PPM, et son type dit si un DAO est attendu |
| **Types de DMC** (`/api/type-dmc`) et mapping mode → type (écran Admin `dmc-mapping-admin`) | référentiel administrable | filtre les lignes de PPM éligibles à un DAO (mode mappé à `DAO`) |
| **Saisie PPM** (grille partagée, `PpmFormFactory`, import PDF) | le PPM porte déjà les 22 informations : entité, PRMP, nature, mode, montant, financement, bénéficiaires, comptes, dates prévisionnelles (`marche-previsions` par CAPM) | source des **reprises PPM**, jamais ressaisies |
| **Versionnement** des PPM (mise à jour = nouvelle version, jamais en place) | livré | même règle pour la fiche : **figée à la validation, nouvelle version à la modification** |
| **Points de contrôle par sous-type** (grille effective `?sousType=`, portées LIGNE / DOSSIER / FICHE / pièces) | l'examen CNM d'un DMC porte aujourd'hui sur les **pièces PDF** jointes | l'examen pourra porter sur la **fiche structurée** (bloc par bloc) et sur les documents générés — lot ultérieur |
| **Modèles Word dérivés par script** (14 PV et lettres, `docs/derivation-modeles-docx.md`, chirurgie au niveau des runs) | savoir-faire acquis | à réemployer pour DPAO / AE / CCAP à partir des **modèles officiels** du service |
| **Justifications de la fiche de présentation** (saisie par ligne et globale, blocage miroir des 400 par champ) | livré | patron d'un formulaire **piloté par un référentiel serveur** avec contrôles nominatifs |

**Le trou réel** : un DAO se rédige aujourd'hui **hors de l'application** (Word), se dépose en PDF, et la Commission
le contrôle en le lisant. Rien ne relie ses informations au PPM d'où elles viennent, rien ne les contrôle avant
dépôt, et chaque document est rempli séparément.

## 3. Cible proposée : le DAO devient un dossier DMC **avec contenu**

**Décision pilote (22/09)** : **la création d'un DAO est un formulaire à remplir — aucun import de PDF**, contrairement
au dossier de planification. Ce que l'esquisse appelle « importé du PPM » n'est pas un fichier : ce sont les 22
informations de la **ligne de PPM déjà dans l'application**, reprises et verrouillées ; le reste se saisit à l'écran.

**Principe** : la fiche marché est le **contenu structuré** du dossier de mise en concurrence de sous-type `DAO`,
rattachée à sa ligne de PPM par le DMC existant. Les documents DPAO / AE / CCAP sont **générés** par le serveur à
la validation et **joints automatiquement** au dossier comme pièces (le PDF « DAO » déposé à la main disparaît pour
ce sous-type). Le dossier suit ensuite **le circuit de contrôle inchangé** : soumission, recevabilité, dispatch,
examen, PV — avec, plus tard, des points de contrôle qui lisent la fiche plutôt qu'un PDF.

### 3.1 Le parcours, dans l'écran « Créer dossier › Dossier de mise en concurrence »

| Étape (esquisse) | Dans PRS 2.0 | Qui |
|---|---|---|
| 1. Créer depuis le PPM | choix du sous-type `DAO`, puis **choix de la ligne de marché** parmi les PPM de la PRMP dont le mode est mappé à `DAO` et qui n'ont pas encore de DAO (`GET /api/dmcs/par-marche`) ; le DMC est créé (ou réutilisé) et les **22 informations** arrivent verrouillées dans B01 | automatique |
| 2. Cadrage | **neuf questions** en tête de fiche ; chaque réponse ouvre ou ferme des rubriques ; le **type de marché** (quantité fixe, à commande, contrat-cadre) est la première | PRMP ou UGPM |
| 3. Saisie bloc par bloc | B02 → B10 dans l'ordre des blocs, **une rubrique = une carte**, champs typés (texte, nombre, montant en chiffres et en lettres, date, liste, oui/non, pièce), **texte type** proposé, **enregistrement à chaque bloc** (brouillon serveur, comme l'examen) | PRMP ou UGPM |
| 4. Reprises | tout champ **repris** est affiché en lecture seule avec sa provenance (« repris du DPAO », « du CCAP ») ; jamais ressaisi | automatique |
| 5. Contrôles | à chaque enregistrement et avant validation : obligatoires, cohérence des dates (lancement < remise < ouverture < attribution), montants, **plafonds réglementaires** (avance ≤ 20 %, garantie de restitution au-delà de 5 %, pénalités ≤ 15 % sauf dérogation, 60/40 du forfait, minimum < maximum, durée du contrat-cadre ≤ 2 ans, délai de paiement 75 jours, intérêts moratoires) — refus **nominatifs par champ**, comme les 400 des justifications | serveur, miroir à l'écran |
| 6. Valider | la PRMP **valide** : la fiche est **figée et versionnée** ; l'UGPM prépare sans valider (arbitrage 6 du 15/09) | PRMP |
| 7. Générer et assembler | le serveur produit DPAO (ou DPAC), AE, CCAP **depuis les modèles officiels**, les joint au dossier ; l'assemblage avec les parties standard du dossier type est un **document de plus** ; puis **soumission** à la CNM comme tout dossier | automatique, puis PRMP |

### 3.2 Ce que l'écran montre (maquette)

Un rail des sept étapes à gauche (comme le parcours d'examen), le **cadrage** en résumé permanent (« Quantité fixe ·
alloti (3 lots) · groupement autorisé · prix unitaires · garantie de soumission exigée »), le **bloc courant** au
centre avec ses rubriques, un panneau « **Contrôles** » à droite (obligatoires manquants, incohérences, plafonds),
et, sur chaque champ, sa **destination** (DPAO, AE, CCAP) et son **état** (importé du PPM, à saisir, repris).

### 3.3 Le référentiel des champs, piloté par la donnée

Chaque ligne du fichier de correspondance devient une ligne d'un **référentiel serveur** `champs-fiche-marche`,
avec les attributs de l'esquisse (§ « Structure d'une information ») : `code` (B05-GS-02), `libelle`, `bloc`,
`rubrique`, `type` (TEXTE, NOMBRE, MONTANT, DATE, LISTE, OUI_NON, PIECE), `source` (PPM, SAISIE), `documentMaitre`
(DPAO, DPAC, AE, CCAP), `reprises[]`, `typesMarche[]` (QUANTITE_FIXE, A_COMMANDE, CONTRAT_CADRE), `condition`
(expression sur le cadrage : `garantieSoumission = OUI`), `obligatoire`, `texteType`, `controle` (règle nommée).
**L'écran se dessine depuis ce référentiel** — comme la grille de contrôle depuis les points de contrôle : ajouter un
champ ou changer une condition ne recompile rien. Le référentiel se charge depuis le fichier de correspondance
**une fois nettoyé** (les 125 points ouverts, les 74 sans document du contrat-cadre, les codes manquants), et
s'administre ensuite à l'écran Admin.

## 4. Ce qui reste hors de l'esquisse, et que l'application impose

- **Le circuit** : la validation PRMP (étape 6) **n'est pas** la soumission à la CNM. Elle fige la fiche et
  déclenche la génération ; la **soumission** reste le geste existant, avec recevabilité, dispatch et examen.
- **L'UGPM** prépare la fiche, la PRMP valide et soumet — même partage que pour les brouillons de PPM.
- **Une ligne de PPM, un DAO** (unicité déjà portée par `t_dossier_mec`) ; la ligne doit venir d'un PPM **contrôlé**
  (PV signé favorable ou favorable avec réserves levées) — à arbitrer (Q7).
- **Le mode de passation** de la ligne détermine que c'est un DAO ; **le type de marché** (quantité fixe, à
  commande, contrat-cadre) est une réponse de cadrage, pas une donnée du PPM.
- **Rien n'est ressaisi** : une information du PPM qui devrait changer se corrige **dans le PPM** (mise à jour =
  nouvelle version), jamais dans la fiche.

## 5. Lotissement proposé

- **Lot 0 — décisions et matière** : les six décisions de l'esquisse + les arbitrages du §7 ; **obtenir** le
  fichier de correspondance complet (les 158 / 165 / 182 lignes : le PDF ne donne que les comptes) et les **modèles
  Word officiels** de DPAO, AE et CCAP (comme le PV officiel qui a servi aux 14 modèles).
- **Lot 1 — la fiche « quantité fixe » (tronc commun)**, sans génération :
  - *backend* : référentiel `champs-fiche-marche` (chargé depuis le fichier nettoyé), `fiches-marche` par DMC
    (cadrage + valeurs par champ, brouillon enregistrable bloc par bloc, contrôles nominatifs, validation qui fige
    et versionne), câblage de `POST /api/dmcs/par-marche` sur le parcours PRMP (aujourd'hui Admin seul) ;
  - *frontend* : dans « Créer dossier › Mise en concurrence › DAO », le choix de la ligne de PPM, le cadrage, la
    saisie par blocs dessinée depuis le référentiel, les reprises affichées, le panneau de contrôles, la validation
    ; les pièces jointes actuelles restent pour le reste du dossier.
- **Lot 2 — génération** : DPAO, AE, CCAP en `.docx` depuis les modèles officiels (méthode des 14 modèles),
  joints au dossier à la validation ; PDF si le pilote le veut (Q5 de l'esquisse) ; assemblage avec les parties
  standard.
- **Lot 3 — à commande** : la section qui s'ouvre (quantités minimum et maximum, durée, date d'effet, montants
  annuels, délais de livraison, rythme de commande une fois codé).
- **Lot 4 — contrat-cadre** : après les décisions 1 et 2 de l'esquisse (CCAP, 74 informations).
- **Lot 5 — examen sur la fiche** : points de contrôle DAO à portée **bloc / rubrique** lisant la fiche, à côté des
  pièces ; observations « au lieu de / lire » ciblant un champ (comme la cellule V30 du PPM).

## 6. Esquisse de contrat — PROPOSITION (à confirmer par le backend)

- `GET /api/champs-fiche-marche?typeMarche=&document=` · Admin : `POST/PUT` (référentiel) · import depuis le
  fichier nettoyé (outil, pas endpoint).
- `POST /api/dmcs/par-marche/{idDetail}` ouvert à la **PRMP / UGPM propriétaire** (aujourd'hui Admin) ; la réponse
  porte les **22 valeurs importées** (`valeursPpm`).
- `GET /api/fiches-marche/{idDmc}` · `PUT /api/fiches-marche/{idDmc}/cadrage` · `PUT /api/fiches-marche/{idDmc}/blocs/{bloc}`
  (valeurs du bloc, 400 nominatifs par champ) · `POST /api/fiches-marche/{idDmc}/controler` (bilan complet) ·
  `POST /api/fiches-marche/{idDmc}/valider` (fige, versionne, génère au lot 2) · `GET …/versions`.
- `GET /api/fiches-marche/{idDmc}/documents/{DPAO|AE|CCAP}` (lot 2, `.docx`), pièces jointes du dossier créées
  par le serveur (`VERSION_GENEREE`).

## 7. Arbitrages demandés au pilote (recommandation en gras)

| # | Question | Reco |
|---|---|---|
| Q1 | **Les six décisions de l'esquisse** (CCAP du contrat-cadre, 74 sans document, 125 points ouverts, codes manquants, format de sortie, rôles) | **Lot 0** : tranchées sur le fichier de correspondance avec le service, avant tout code ; **format = Word depuis les modèles officiels**, PDF en plus pour la publication ; **rôles = UGPM prépare, PRMP valide et soumet** |
| Q2 | Le DAO généré est-il **le contenu contrôlé** par la CNM, ou la Commission continue-t-elle de contrôler un PDF joint ? | **La fiche structurée**, avec les documents générés joints ; l'examen sur la fiche est le lot 5, l'examen sur pièces reste possible entre-temps |
| Q3 | Point d'entrée : depuis « Créer dossier › Mise en concurrence › DAO », ou depuis la ligne du PPM (« Préparer l'appel d'offres » dans le dossier de planification) ? | **Les deux** : le second n'est qu'un raccourci vers le premier, ligne pré-choisie |
| Q4 | Quelles lignes de PPM sont éligibles ? | **PPM au PV signé**, avis favorable ou réserves levées, mode mappé à `DAO`, ligne sans DAO existant ni retirée |
| Q5 | La fiche est-elle **enregistrée bloc par bloc** (brouillon serveur) ou d'un seul tenant ? | **Bloc par bloc** — 130 informations ne se saisissent pas en une fois ; même patron que l'examen |
| Q6 | Ordre des lots : génération (lot 2) avant « à commande » (lot 3) ? | **Oui** : un DAO à quantité fixe complet, généré et contrôlé, vaut plus que trois types saisis sans document |
| Q7 | Une information du PPM à corriger pendant la préparation du DAO | **Se corrige dans le PPM** (nouvelle version), la fiche se rafraîchit ; jamais dans la fiche |

## 8. Hors périmètre

**Import d'un DAO au format PDF** (décision pilote du 22/09 : la création est un formulaire) ; consultation de prix et bon de commande (autres types de DMC) ; travaux et prestations intellectuelles (le fichier
ne couvre que les fournitures) ; le dossier de marché (DDM) ; la publication du DAO ; l'évaluation des offres.
