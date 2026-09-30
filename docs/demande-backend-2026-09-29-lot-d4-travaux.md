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
>
> ⚠️ **Livraison backend du 2026-09-30 (suite §B3).** Fait.
> - DPAO-T est recopié tel quel (247/247 sur le rendu brut du serveur ; les onze modèles restent fidèles).
> - `B04-VO-01` est servi aux fournitures et aux travaux, dans les trois formes. `B04-DV-01` et `B04-VT-01` sont
>   retirés, et leurs valeurs conservées (aucune sur DBPRS20).
> - La **rubrique** `B04-VO` est élargie aux travaux par la migration **V55**. C'est la leçon de V54 : le référentiel
>   filtre les rubriques par catégorie. Les rubriques `B04-DV` et `B04-VT`, désormais sans champ actif, ne sont plus
>   servies.
> - Script DBPRS20 : `docs/referentiel/2026-09-30-validite-offres-unique.sql`, à passer après le redémarrage (il
>   s'arrête si V55 manque).
>
> Conséquences :
> - l'AE d'un contrat-cadre de travaux imprime le délai saisi, et non plus « … » ;
> - `B04-VO-01` porte le rôle `OFFRE` de `VALIDITE_GARANTIE_SUP_OFFRE`. Son partenaire `GARANTIE` (`B05-GS-04`) n'est
>   servi qu'aux fournitures : pour les travaux, la règle reste donc sans objet, comme avant.

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
>
> ⚠️ **30/09 — écart résorbé côté front, et deux règles de lecture NOUVELLES à reporter dans `LectureDao`.**
> - « et » / « ou » : `lire.mjs` suit désormais `DEBUT_TERME` (séparateur seulement devant une clé et un opérateur).
> - **R-a, texte répété** : un paragraphe du modèle dont le texte fixe se répète ailleurs dans le modèle (« Non
>   applicable ») ne se cherche que dans les **3 paragraphes** qui suivent le curseur (au lieu de 60). Absent du
>   document, il se raccrochait au « Non applicable » d'un article plus loin, et la lecture sautait tout l'intervalle
>   (CCAP-T : l'article 8, assurances, perdu).
> - **R-b, section absente** : dans un intervalle à plusieurs jetons seuls, on écarte les jetons dont une section est
>   **absente**. Une section est absente quand elle a au moins un paragraphe distinctif et qu'aucun de ses paragraphes
>   n'est reconnu. S'il ne reste qu'un jeton, il est proposé en confiance **basse** (CCAP-T : « {{B02-OT-02}}. »
>   suivi de la liste des lots, sous ALLOTI, sur un marché non alloti).
>
> Banc après les deux règles : CCAP-T passe de 56-68 % à 73-74 %, CCAP-F de 88-93 % à 94-97 %, DPIC-PI et DPAO-T à
> 96-100 %, CPS-PI de 65 % à 77-78 %, sans aucune fausse valeur sur le rendu propre. Avec bruit, sur huit graines,
> tous modèles : 3 561 valeurs justes au lieu de 3 417 (+144) pour 112 fausses au lieu de 107 (+5), **aucune en
> confiance haute** (Q10 tenu). Le reste du CCAP-T, ce sont les cinq sujétions saisies côte à côte (B09-CH-01…05) : l'ambiguïté est réelle,
> la lecture ne choisit pas.
>
> ⚠️ **Livraison backend du 2026-09-30 (suite §B4).** Les deux règles sont portées dans `LectureDao` telles quelles :
> - **R-a** : `FENETRE_REPETE = 3` pour un paragraphe dont le texte fixe se répète dans le modèle, avec ou sans jeton ;
> - **R-b** : une section absente est écartée d'un intervalle à plusieurs jetons seuls, et le jeton restant est lu en
>   confiance basse.
>
> Tests `LectureDaoTest.regleTexteRepete` et `regleSectionAbsente`. Tous deux échouent quand la règle est neutralisée.
> `DEBUT_TERME` était déjà la règle du serveur : rien à porter.
>
> **Parité refaite sur les sept entrées** (dossier 27 en Word et en PDF, dossier 2463 en PDF, et les rendus bruts des
> fournitures, des PI, des travaux et du contrat-cadre) :
> - extraction identique ;
> - propositions, ambiguïtés, conflits et non-trouvés **identiques**. L'écart « Au fur et à mesure » est résorbé.
>
> Il ne reste que l'écart de sortie connu (ADR-0012) : une clé de cadrage lue avec deux valeurs est rendue en conflit
> seul par le serveur, alors que le front garde aussi la première valeur dans `cadrage`.

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
