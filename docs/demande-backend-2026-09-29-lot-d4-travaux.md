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

> ⚠️ **Livraison backend du 2026-09-30 (§B1).** Conforme. Les trois fichiers sont recopiés tels quels, avec 34, 30 et
> 70 conditions, et couverts pour la quantité fixe et le marché à commande des travaux (types `DPAO`, `CCAP`, `AE` ;
> l'AE par lot sur une ligne allotie). Le comparateur donne 247/247, 363/363 et 570/570 sur le rendu brut du serveur ;
> les huit autres modèles restent identiques. Deux précisions :
> - **Le CCAP des travaux garde le libellé « Cahier des clauses administratives particulières »** : c'est le titre du
>   document type. Seuls les CCAP des fournitures et des PI s'intitulent « Cahier des prescriptions spéciales ».
> - **`B11-FR-01` à `-06` sont retirés** (`actif = non`). Aucune règle ne les lit, et aucune valeur n'est saisie sur
>   DBPRS20. Le retrait est réversible en une ligne si le pilote préfère les garder comme rappel. La rubrique `B11-FR`
>   n'est plus servie, puisqu'elle n'a plus de champ actif ; le bloc B11 garde `B11-AN`.

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

> ⚠️ **Livraison backend du 2026-09-30 (§B2.1).** Les six codes proposés sont gardés, tous **facultatifs**. Les deux
> délais d'affermissement portent `tranches = OUI` ; les quatre autres n'ont pas de condition. Trois précisions :
> - **`B09-BT-01` demandait une rubrique** : `B09-BT` « Travaux de bâtiment » n'existait pas. Elle est créée par la
>   migration **V54** (bloc B09, document maître CCAP, quantité fixe et à commande, travaux). Le script DBPRS20 se passe
>   donc **après** le redémarrage, et il s'arrête net si V54 manque.
> - **`B05-GE-05` est sans règle serveur** : le plafond de 5 % reste dans le libellé. Si le pilote veut un
>   avertissement, il s'ajoute sur le modèle de `AVANCE_MAX_20`.
> - **Option `MIXTE` : rien à faire côté serveur.** `typePrix` est un reflet sans liste fermée, et la valeur `MIXTE` est
>   déjà acceptée et enregistrée. L'AE-T imprime son annexe 1 « prix partiels et forfaitaires » (test `prixMixtes`).
>   Seul le front ajoute l'option à la question du cadrage.

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

> ⚠️ **Livraison backend du 2026-09-30 (§B2.2).**
> 1. `B02-LT-01` : condition `alloti = OUI`. Fait.
> 2. `B04-OV-02` : `DATE_HEURE`. Fait.
> 3. Fait. Le reflet `B09-PR-01` est servi aux travaux (**V54**) et `B09-PE-01` est retiré ; `B09-PE-02` reste. Le
>    plafond est celui du CCAG des travaux, **15 %**, comme l'aide du front le dit déjà. Seules les prestations
>    intellectuelles ont 10 %.
>    **Correctif en passant** : la *rubrique* `B09-PR` n'était servie qu'aux fournitures. Depuis V53, le reflet était
>    donc servi aux prestations intellectuelles **hors de toute rubrique**, et l'écran ne pouvait pas le placer. V54
>    l'ouvre aux trois catégories.
> 4. Doublons : rien à faire au backend. Les modèles suivent déjà `B06-PN-01` et `B01-AC-17`. `B03-QT-11` et `B02-MW-03`
>    relèvent du point 6.
> 5. `parLot` de `B05-GQ-03` et `B09-DL-01` : **non fait**, puisque la demande le présente comme souhaitable et non
>    arbitré. Il faudrait passer les deux champs en `parLot = oui` et remplacer les jetons par `{{CODE.parLot}}` dans
>    DPAO-T (mécanique du lot D2). Le front doit recopier le modèle, puisque la fidélité se mesure de son côté.
> 6. **Non touché**, en attente du pilote.
 — Contrat-cadre de travaux : harmoniser les codes (T-2, décision Q1)

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

> ⚠️ **Livraison backend du 2026-09-30 (§B3).** Les deux fichiers sont recopiés (16 et 55 conditions, 179/179 et
> 408/408) et couverts pour le contrat-cadre de travaux. Les sept rédactions « CCAG Travaux » sont vérifiées par le test
> `contratCadreTravaux`, et leur absence en fournitures aussi. L'harmonisation a été faite **à l'identique près**, avec
> quatre écarts :
> - **Ouverts aux travaux : 89 champs.** Ce sont tous ceux du contrat-cadre des fournitures que citent DPAC-CC et AE-CC
>   et qui n'étaient pas déjà servis aux travaux, dont les 11 « sans équivalent ». Les 15 de même code l'étaient
>   déjà. **Retirés : 47 doublons
>   du contrat-cadre de travaux**, repérés par un libellé identique après normalisation (apostrophes, tirets, espaces).
>   Les valeurs éventuelles sont conservées. Exemples : `B02-SW-*` → `B02-SG-*`, `B04-CT-*` → `B04-CP-*`,
>   `B08-FT-*` → `B08-FP-*`, `B05-PX-*` → `B05-PM-*`, `B07-PY-*` → `B07-PE-*`, `B10-LT-01` → `B10-VR-01`. La liste
>   complète est dans le script `docs/referentiel/2026-09-29-lot-d4-travaux.sql`.
> - **Les 15 « douteux » ne sont pas tranchés** : ils restent actifs avec leur code travaux, en attendant la liste de
>   la partie C arbitrée champ par champ. Un doublon qui resterait apparaîtrait deux fois à la saisie, sans rien casser.
> - **Rubriques** : le référentiel ne sert une rubrique qu'à ses catégories. Les **33 rubriques** du contrat-cadre des
>   fournitures qui portent ces champs sont donc élargies aux travaux par **V54** ; sinon les champs auraient été servis
>   hors rubrique. Une rubrique dont tous les champs sont retirés disparaît d'elle-même, par exemple `B02-SW` et
>   `B04-CT`.
> - **Reflets** : `AE-CC` cite `{{B02-LV-05}}` (nombre de lots) et `{{B08-AV-02}}` (taux de l'avance), reflets des
>   fournitures. Plutôt que de les ouvrir aux travaux, le rendu lit désormais **tout reflet sans valeur servie sur sa
>   clé de cadrage** (`nbLots`, `tauxAvance`). La règle est générale : elle vaut pour tout modèle (ADR-0011, complément
>   D4).
>
> ⚠️ **Point ouvert : le délai de validité des offres.** `AE-CC` cite `{{B04-VO-01}}`, que le référentiel partage entre
> les trois formes des fournitures. L'élargir aux travaux le servirait aussi aux travaux à quantité fixe et à commande,
> en double de `B04-DV-01`, que cite DPAO-T. Il est donc **laissé aux fournitures**, et `B04-VT-01` (travaux,
> contrat-cadre, même libellé) **reste actif**. Conséquence : **dans un contrat-cadre de travaux, l'AE imprime « … » à
> la place du délai de validité.** Proposition : DPAO-T cite `{{B04-VO-01}}` à la place de `{{B04-DV-01}}` (le front
> recopie). Le backend élargit alors `B04-VO-01` aux travaux et retire `B04-DV-01` et `B04-VT-01`, soit une ligne de
> script. À défaut, AE-CC peut citer `{{B04-VT-01}}` sous condition `CCAG-TRAVAUX`.
>
> ⚠️ **30/09 — proposition retenue, côté front fait.** DPAO-T cite désormais `{{B04-VO-01}}` (décalque
> `docs/modeles-dao/DPAO-T.docx` régénéré, vérifié 247/247 ; `scripts/modeles-dao/modeles/DPAO-T.{txt,json}`).
> **Reste au backend :** recopier le modèle DPAO-T, élargir `B04-VO-01` aux travaux (les trois formes) et retirer
> `B04-DV-01` et `B04-VT-01`. Au passage, le front a aligné sa lecture sur `DEBUT_TERME` : « et » / « ou » ne
> séparent deux termes d'une condition que suivis d'une clé et d'un opérateur (« Au fur et à mesure des besoins »
> reste une valeur).

## B4 — Production et import

- Une fiche de travaux validée produit DPAO-T, AE-T, CCAP-T (marché ordinaire) ou DPAC-CC, AE-CC (contrat-cadre) au
  format du document type.
- Import : aucune règle de lecture nouvelle ; `LectureDao` lit les nouveaux modèles tels quels. Mesure au banc
  (`scripts/import-dao/banc.mjs`) : DPAO-T 92-93 %, AE-T 100 %, CCAP-T 56-68 % (assurances et sujétions : saisies libres
  côte à côte, signalées ambiguës), **aucune valeur fausse en confiance haute**, sans bruit et sur huit graines.

> ⚠️ **Livraison backend du 2026-09-30 (§B4).** Conforme, sans règle nouvelle. Parité `LectureDao` ≡ `lire.mjs`
> vérifiée sur les rendus bruts des trois modèles de travaux et du contrat-cadre recopié :
> - extraction identique, 0 ligne de diff ;
> - propositions, cadrage et non-trouvés identiques (DPAO-T 144/160, AE-T 288/293, CCAP-T 13/421 sur le rendu brut
>   concaténé, les mêmes des deux côtés).
>
> Seul écart : les conflits de **clés de cadrage** lues dans une condition dont la valeur contient « et ». Le front
> coupe « Au fur et à mesure des besoins » en « Au fur », le serveur garde la valeur entière. C'est l'écart connu
> depuis le lot D1. `MODELE_ABSENT` ne répond plus pour les travaux : toutes les formes outillées sont désormais
> couvertes, sauf le contrat-cadre de prestations intellectuelles.

## B5 — Tests attendus

- les trois modèles recopiés : rendu ≡ modèle (247, 363, 570) ; DPAC-CC et AE-CC (179, 408) ;
- une fiche de travaux par grand cas : prix unitaires sans tranche ; forfaitaire avec deux tranches conditionnelles ;
  alloti et révisable avec avance et garantie bancaire de bonne exécution ; travaux de bâtiment (CPC/TBM et décennale) ;
- un contrat-cadre de travaux : les sept rédactions « CCAG Travaux » ;
- les six annexes du CCAP présentes ou absentes selon leurs conditions.

> ⚠️ **Livraison backend du 2026-09-30 (§B5).** `ModelesDaoTravauxTest` (pur) couvre :
> - les quatre cas ;
> - les prix mixtes ;
> - le contrat-cadre de travaux : les sept « CCAG Travaux », leur absence en fournitures, et les reflets lus sur le
>   cadrage.
>
> Les annexes sont vérifiées cas par cas :
> - la révision seulement si les prix sont révisables ;
> - la bonne exécution, bancaire ou par caution, selon `B05-GE-03` ;
> - les deux modèles de restitution d'avance si `avance = OUI` et `B05-GA-01 = OUI` ;
> - le cadre de bordereau, toujours.
>
> Côté intégration, `FicheDaoTravauxIntegrationTest` couvre la production par une fiche de travaux validée. Écart :
> **`FicheMarcheDocumentsIntegrationTest`** (rendu générique « libellé : valeur » du lot 2a) portait sur une ligne de
> travaux. Il porte désormais sur un **contrat-cadre de prestations intellectuelles**, la seule forme restée au lot 2a
> (DPIC et contrat-cadre valant AE).

## Pour le juriste (pas pour le backend)

Texte officiel reproduit tel quel (Q5) : le CCAP renvoie à « l'article 16 » pour les délais d'affermissement (c'est
l'article 5) ; la phrase du DPAO « Une (01) copie » contredit la clause 7.1 — **retirée**, avec sa raison ; le contrat-cadre
garde des critères d'exemple « qualité de la fourniture, délai de livraison » valables aussi pour des travaux ?

## Ce que le backend rend

Commit(s) qui referment B1 à B5, scripts du référentiel pour DBPRS20, tests, et un encadré ⚠️ daté ici pour tout écart.
