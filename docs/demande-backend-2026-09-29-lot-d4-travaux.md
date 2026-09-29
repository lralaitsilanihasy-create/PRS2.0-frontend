# Demande backend — Lot D4 (T-1, T-2) : les DAO de travaux produits et importés

**Date** : 2026-09-29 · **Émetteur** : front · **Plan** : `docs/plan-2026-09-29-lot-d4-travaux.md` (arbitrage du pilote
du 29/09 : Q1 codes du contrat-cadre **harmonisés**, Q2 délais d'affermissement créés, Q3 tranches communes à tous les
lots, Q5 texte fidèle ; les autres questions suivent la recommandation) · **Analyse** :
`docs/analyse-2026-09-29-documents-types-travaux.md`.

Les deux fiches de travaux du classeur `DAO_Travaux.xlsx` : la feuille « A tranche_Alloti » (marché ordinaire) et la
feuille « Contrat-cadre ». Aucune extension du moteur n'est nécessaire.

## B1 — Marché ordinaire de travaux : recopier trois modèles et les couvrir (T-1)

| sigle | document | source ARMP | conditions | fidélité (`verifier.mjs`) |
|---|---|---|---|---|
| `DPAO-T` | Données particulières d'appel d'offres | doc 2 | 34 | 247 / 247 |
| `AE-T` | Acte d'engagement | doc 4 | 30 | 363 / 363 |
| `CCAP-T` | CCAP (32 articles) **et ses six annexes** | doc 5 | 70 | 570 / 570 |

- Fichiers : `scripts/modeles-dao/modeles/{DPAO-T,AE-T,CCAP-T}.txt` ; décalques `docs/modeles-dao/`.
- `ModelesDao.COUVERTURES` : les trois sigles pour `QUANTITE_FIXE` **et** `A_COMMANDE`, catégorie `TRAVAUX` (le
  référentiel servi est le même pour les deux formes ; le document type n'a pas de variante « à commande »).
- **Les six champs `PIECE` `B11-FR-01` à `-06`** (formule de révision, garantie bancaire et caution de bonne exécution,
  garantie bancaire et caution de restitution d'avance, cadre du bordereau et du détail quantitatif) : leurs modèles sont
  **les annexes du CCAP officiel**, désormais produites dans `CCAP-T`, chacune sous sa condition. Les six champs n'ont
  plus d'objet à la fiche — à retirer pour la catégorie (après la vérification habituelle), ou à garder comme simple
  rappel si le pilote le préfère.

## B2 — Référentiel des travaux (marché ordinaire)

### B2.1 — Champs et options à créer

| code proposé | libellé | type | document | condition | décision |
|---|---|---|---|---|---|
| `B02-MW-04` | Maître d'ouvrage délégué : nom et coordonnées | TEXTE_LONG | AE | — | Q6 |
| `B02-LT-06` | Délai d'affermissement de la tranche conditionnelle 1 | TEXTE | CCAP | `tranches = OUI` | Q2 |
| `B02-LT-07` | Délai d'affermissement de la tranche conditionnelle 2 | TEXTE | CCAP | `tranches = OUI` | Q2 |
| `B04-VL-02` | Visite des lieux obligatoire | OUI_NON | DPAO | — | Q7 |
| `B05-GE-05` | Taux de la garantie de bonne exécution (%, au plus 5 %) | POURCENTAGE | CCAP | — | Q7 |
| `B09-BT-01` | Travaux de bâtiment (CPC, TBM, responsabilité décennale) | OUI_NON | CCAP | — | Q8 |
| option de `B09-DT-01` | « À la notification de l'ordre de service de commencer les travaux » | — | — | — | AE 5.1 |
| option `MIXTE` de `typePrix` | « Prix unitaires et forfaitaires (mixte) », pour les travaux | — | — | — | Q4 (annexe 1 de l'AE, 3ᵉ variante) |

### B2.2 — Corrections

1. **`B02-LT-01` (description du projet global)** : condition **inversée** (`alloti = NON`), alors que le DPAO ne l'emploie
   qu'en allotissement (« Les lots suivants faisant partie de <projet global> ») → `alloti = OUI`.
2. **`B04-OV-02` (date et heure limites)** : `DATE` → `DATE_HEURE` (le DPAO exige l'heure).
3. **Pénalités** : le modèle suit la question `penalites` du cadrage, comme ailleurs → ouvrir le reflet `B09-PR-01` aux
   travaux (comme V53 pour les PI), plafond du CCAG des travaux ; `B09-PE-01` (oui/non) est à retirer. `B09-PE-02`
   (millièmes) reste.
4. **Doublons** : préférence nationale `B03-QT-11` / `B06-PN-01` (le modèle suit `B06-PN-01`) ; imputation budgétaire
   `B02-MW-03` / `B01-AC-17` (le modèle suit `B01-AC-17`, comme les fournitures).
5. **Par lot** : `B05-GQ-03` (montant de la garantie de soumission) et `B09-DL-01` (délai d'exécution) gagneraient à être
   `parLot` ; les modèles les impriment aujourd'hui en valeur unique (les tranches, elles, sont communes à tous les lots, Q3).
6. **Mal placés ou sans place** (même règle que les fournitures et les PI : retirer pour la catégorie après vérification,
   **à confirmer par le pilote**) : données du candidat maîtres « AE » (`B03-GT-02`, `B03-SU-01`, `B03-SU-02`, `B08-DB-01`,
   `B11-AN-01` à `-05`) ; sans place : `B08-MO-01` (le CCAP écrit « taux directeur augmenté de un point » en dur),
   `B10-RE-01` (article 30 entièrement fixe), `B08-AF-02`, `B05-GA-02`, `B03-QT-11`, `B02-MW-03`, `B08-MR-02` à `-04`,
   `B09-RP-02`.

## B3 — Contrat-cadre de travaux : harmoniser les codes (T-2, décision Q1)

Le document type du contrat-cadre (« Fournitures & Prestations de services ») sert aussi les travaux : ses sept choix
« CCAG Fournitures / CCAG Travaux <choisir> » sont désormais choisis par la **catégorie** dans `DPAC-CC` et `AE-CC`
(conditions `CCAG-FOURNITURES` / `CCAG-TRAVAUX` ; le titre du DPAC perd « marché de fournitures et services » pour les
travaux). Fidélité 179 / 179 et 408 / 408. Recopier les deux fichiers.

**Harmonisation** : le référentiel du contrat-cadre de travaux (158 champs, recodé le 24/09 avant l'axe des catégories)
reprend **les codes du contrat-cadre de fournitures** : un même code sert les deux catégories (`categories` élargies à
`TRAVAUX`), une seule description, une seule lecture. Correspondance mesurée (analyse, partie C) :

| | champs des modèles |
|---|---|
| même code | 15 |
| même libellé, autre code (`B04-CT-*` → `B04-CP-*`, `B02-SW-*` → `B02-SG-*`, `B08-FT-*` → `B08-FP-*`…) | 47 |
| douteux (à trancher champ par champ, liste en partie C) | 15 |
| sans équivalent travaux (champs créés le 28/09 pour les fournitures : reconduction, préavis, fautes…) | 11 → servis aux travaux |

DBPRS20 est vide : **aucune valeur à migrer**. Les champs propres aux travaux sans équivalent fournitures restent avec
leur code. `ModelesDao.COUVERTURES` : `DPAC-CC` et `AE-CC` pour `CONTRAT_CADRE` × `TRAVAUX`.

## B4 — Production et import

- Une fiche de travaux validée produit DPAO-T, AE-T, CCAP-T (marché ordinaire) ou DPAC-CC, AE-CC (contrat-cadre) au
  format du document type.
- Import : aucune règle de lecture nouvelle ; `LectureDao` lit les nouveaux modèles tels quels. Mesure au banc
  (`scripts/import-dao/banc.mjs`) : DPAO-T 92-93 %, AE-T 100 %, CCAP-T 56-68 % (assurances et sujétions : saisies libres
  côte à côte, signalées ambiguës), **aucune valeur fausse en confiance haute**, sans bruit et sur huit graines.

## B5 — Tests attendus

- les trois modèles recopiés : rendu ≡ modèle (247, 363, 570) ; DPAC-CC et AE-CC (179, 408) ;
- une fiche de travaux par grand cas : prix unitaires sans tranche ; forfaitaire avec deux tranches conditionnelles ;
  alloti et révisable avec avance et garantie bancaire de bonne exécution ; travaux de bâtiment (CPC/TBM et décennale) ;
- un contrat-cadre de travaux : les sept rédactions « CCAG Travaux » ;
- les six annexes du CCAP présentes ou absentes selon leurs conditions.

## Pour le juriste (pas pour le backend)

Texte officiel reproduit tel quel (Q5) : le CCAP renvoie à « l'article 16 » pour les délais d'affermissement (c'est
l'article 5) ; la phrase du DPAO « Une (01) copie » contredit la clause 7.1 — **retirée**, avec sa raison ; le contrat-cadre
garde des critères d'exemple « qualité de la fourniture, délai de livraison » valables aussi pour des travaux ?

## Ce que le backend rend

Commit(s) qui referment B1 à B5, scripts du référentiel pour DBPRS20, tests, et un encadré ⚠️ daté ici pour tout écart.
