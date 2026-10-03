# Demande backend — Fiche DAO des travaux : le matériel et le personnel exigés, en listes

**Date** : 2026-10-03 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-02-fiche-travaux-structuree.md`,
**lot 3**, lancé par le pilote le 03/10 (« poursuis le lot 3 »), après la clôture des lots 1 et 2
(`demande-backend-2026-10-02-dqe-et-seuils-travaux.md`). La règle Q4 du plan vaut ici aussi : **les champs texte
existants restent en complément**, et la liste fait foi.

**Ce qui manque aujourd'hui.** La clause 6.3 du DPAO-T imprime :
- le matériel exigé dans un texte libre, `B03-QT-09` (le libellé parle de « forme sous laquelle l'entrepreneur
  disposera du matériel », mais le champ remplace en fait le trou « <indiquer une liste de ces gros matériels> ») ;
- le personnel clé dans un autre texte libre, `B03-QT-13`.

Un texte ne se contrôle pas, et la soumission en ligne ne peut pas s'en servir. La correspondance avec le DAO du MTP l'a
relevé (⚠ sur `B03-QT-09`, information sans champ n° 2).

**Les deux cas réels** (fiches des faits ; DAO non suivis, filigranes nominatifs) :

| | MEN, bâtiment (`jeu-donnees-men-travaux-faits.md`) | MTP, route (`jeu-donnees-mtp-routier-faits.md` §3) |
|---|---|---|
| **matériel** | 5 engins, **1 de chaque**, « propriété ou location justifiée » : bétonnière ≥ 350 l, camion ou camionnette ≥ 2,5 t, voiture de liaison 4×4, pervibrateur, groupe électrogène ≥ 3 kVA | **10 engins**, avec un **nombre** et un **minimum en propre** : camions bennes ≥ 10 000 kg, 6 dont au moins 4 en propre ; citerne à eau ≥ 5 000 l, 2 dont au moins 1 en propre ; 8 autres « en propre » (pelle, chargeuse, niveleuse, compacteurs lourd et léger, 2 bétonnières ≥ 500 l, 2 pervibrateurs, 4×4) |
| **personnel** | **par lot** : 1 conducteur de travaux (ingénieur BTP ou équivalent, 3 ans), 1 chef de chantier (technicien supérieur BTP, 3 ans) ; CV avec photo, diplôme certifié | conducteur de travaux (ingénieur BTP ou génie civil, **5 ans en travaux routiers**) ; chef de chantier (ingénieur ou TS, **3 ans en travaux routiers**) ; CV et diplôme certifié |

Les noms de propriétés, de ressources et de jetons ci-dessous sont des **propositions**, à votre main.

---

## B1 — Deux listes de la fiche, sur le modèle du besoin

### B1.1 — Les ressources

Comme `/articles` : des données de la version de fiche, figées à la validation, copiées à la révision, pour la
catégorie **TRAVAUX** seulement (409 hors travaux, comme `BESOIN_HORS_PERIMETRE`).

| Méthode | URL (proposée) | Corps | Réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/materiel` | — | `MaterielExigeDto[]`, dans l'ordre |
| PUT | `/api/fiches-marche/{idDmc}/materiel` | `{ "materiel": [MaterielExigeDto…] }` | toute la liste (remplacement ; l'ordre est la position) |
| GET | `/api/fiches-marche/{idDmc}/personnel` | — | `PersonnelExigeDto[]` |
| PUT | `/api/fiches-marche/{idDmc}/personnel` | `{ "personnel": [PersonnelExigeDto…] }` | toute la liste |

**Pas de lot dans l'adresse** : dans les deux DAO, les exigences sont les mêmes pour tous les lots. Le MEN dit « par
lot » pour signifier que **chaque** lot mobilise son équipe : c'est un drapeau de la ligne (`parLot`), pas une liste
par lot (H1).

> ⚠️ **Livraison backend du 2026-10-03 (§B1.1, V60).** Conforme, **H1** comprise : les quatre adresses proposées, une liste
> par fiche, figée à la validation, copiée à la révision, supprimée avec la fiche. Hors travaux, 409 **`MOYENS_HORS_PERIMETRE`**
> ; sur une version validée, 409 `FICHE_VALIDEE`.

### B1.2 — Une ligne de matériel

| propriété | type | MEN | MTP | règle |
|---|---|---|---|---|
| `designation` | texte ≤ 200 | « Bétonnière » | « Camions bennes » | obligatoire |
| `caracteristique` | texte ≤ 200, facultatif | « ≥ 350 l » | « ≥ 10 000 kg » | capacité, puissance… |
| `nombre` | entier ≥ 1 | 1 | 6 | obligatoire |
| `minimumEnPropre` | entier 0…`nombre`, facultatif | — | 4 | `null` = propriété ou location indifférente ; `= nombre` = tout en propre |
| `parLot` | booléen, défaut `false` | — | — | « par lot » : le nombre vaut pour chaque lot |

400 nominatifs (`materiel[i].nombre`…) : désignation manquante ou trop longue, nombre < 1, minimum hors de 0…nombre.

> ⚠️ **Livraison backend du 2026-10-03 (§B1.2).** Conforme : les noms et règles du tableau, 400 nominatifs `materiel[i].…`. Un
> minimum de 0 vaut « indifférent », comme `null`.

### B1.3 — Une ligne de personnel

| propriété | type | MEN | MTP | règle |
|---|---|---|---|---|
| `poste` | texte ≤ 200 | « Conducteur de travaux » | « Conducteur de travaux » | obligatoire |
| `nombre` | entier ≥ 1, défaut 1 | 1 | 1 | |
| `diplome` | texte ≤ 500, facultatif | « Ingénieur BTP ou équivalent (génie civil, industriel, rural, architecture) » | « Ingénieur BTP ou génie civil » | |
| `experienceAnnees` | entier ≥ 0, facultatif | 3 | 5 | |
| `domaineExperience` | texte ≤ 200, facultatif | — | « travaux routiers » | |
| `justificatifs` | texte ≤ 500, facultatif | « CV avec photo, diplôme certifié » | « CV et diplôme certifié » | |
| `parLot` | booléen, défaut `false` | `true` | — | |

> ⚠️ **Livraison backend du 2026-10-03 (§B1.3).** Conforme : `nombre` vaut 1 s'il est absent ; 400 `personnel[i].…`
> (poste manquant ou trop long, nombre < 1, expérience négative, textes trop longs).

### B1.4 — Où l'écran les saisit

Un bloc à rendu propre, comme `B12` : **proposé `B13` « Matériel et personnel exigés »**, avec `rendu = 'MOYENS'`, servi
au référentiel des travaux (les trois types de marché, comme le DQE). L'écran y montre les deux listes. Les champs
`B03-QT-09` et `B03-QT-13` restent dans `B03`, en complément.

> ⚠️ **Livraison backend du 2026-10-03 (§B1.4).** Conforme : bloc **`B13` « Matériel et personnel exigés »**, `rendu = 'MOYENS'`,
> servi aux travaux dans les trois types de marché. Il a deux rubriques sans champ, `B13-MA` « Matériel exigé » et
> `B13-PE` « Personnel clé exigé ». `B03-QT-09` et `B03-QT-13` restent dans `B03`.

---

## B2 — L'impression : deux jetons, une ligne par entrée

Le moteur sait déjà écrire une ligne par élément (`{{BESOIN.series}}`). Les jetons proposés :

- **`{{MOYENS.materiel}}`**, une ligne par engin :
  - avec un minimum : « - Camions bennes ≥ 10 000 kg : 6, dont au moins 4 en propre » ;
  - tout en propre : « - Niveleuse : 1, en propre » ;
  - sans minimum : « - Bétonnière ≥ 350 l : 1 » ;
  - par lot : « … : 1 par lot ».
- **`{{MOYENS.personnel}}`**, une ligne par poste : « - Conducteur de travaux (1) : ingénieur BTP ou génie civil ; au
  moins 5 ans d'expérience en travaux routiers ; justificatifs : CV et diplôme certifié ». Les morceaux absents
  disparaissent avec leur séparateur. Par lot : « (1 par lot) ».

Liste vide : pointillés, comme les autres jetons. C'est **le front** qui recopiera le DPAO-T (clause 6.3, (c) et (e)) :
la liste d'abord, puis le texte de `B03-QT-09` / `B03-QT-13` s'il est saisi. Je vous enverrai le modèle avec ses
conditions, une fois les noms des jetons fixés, et le texte soumis au pilote.

> ⚠️ **Livraison backend du 2026-10-03 (§B2).** Les jetons proposés sont retenus tels quels :
> - **`{{MOYENS.materiel}}`** et **`{{MOYENS.personnel}}`**, une ligne par entrée, à la lettre de vos exemples ;
> - « en propre » quand le minimum égale le nombre ; rien quand il est vide ou nul ;
> - le diplôme prend une minuscule initiale (« ingénieur BTP… »), sauf un sigle (« BTS… ») ;
> - sans années, un domaine seul donne « expérience en … » ; une année donne « au moins 1 an d'expérience » ;
> - liste vide : pointillés.
>
> Les valeurs sont figées à la validation, comme `{{BESOIN.series}}`. J'attends le DPAO-T avec ses conditions.
> `MOYENS.materiel renseigne` **ne se lit pas** dans une condition : ce n'est pas un champ. Il faudra tester `B03-QT-09`
> pour le texte en complément, et laisser le jeton dire ses pointillés si la liste est vide. Si une condition sur la
> liste vous est nécessaire, dites-le.

---

## B3 — Les contrôles

- **`MATERIEL_EXIGE`** (bloquant) : une fiche de travaux doit dire son matériel, par la liste **ou** par `B03-QT-09`.
  `B03-QT-09`, aujourd'hui obligatoire, devient **facultatif** (H2).
- **`PERSONNEL_CLE`** : aucun contrôle nouveau. `B03-QT-13` est facultatif, et la liste aussi.
- `B03-QT-10` (années d'expérience du directeur des travaux, (d) de la clause 6.3) **ne change pas** (H3).

> ⚠️ **Livraison backend du 2026-10-03 (§B3).** Conforme, **H2** et **H3** comprises :
> - **`MATERIEL_EXIGE`** est bloquante : la liste du matériel, ou `B03-QT-09`, qui devient facultatif et porte le rôle
>   `MATERIEL_EXIGE:TEXTE` ;
> - message : « Le matériel exigé n'est pas dit : remplissez la liste du matériel, ou « Forme sous laquelle
>   l'entrepreneur disposera du matériel (propriété, location…) ». »
>
> **Écart :** la règle ne vaut que là où `B03-QT-09` est servi (quantité fixe et à commande). Le contrat-cadre de
> travaux n'a pas ce champ, et son DPAC n'a pas de clause 6.3 : la règle ne lui dit rien, même si le bloc `B13` lui est
> servi. Pas de contrôle sur le personnel ; `B03-QT-10` ne change pas.

---

## Hypothèses

- **H1** — Une seule liste par fiche, avec un drapeau `parLot` sur la ligne, plutôt qu'une liste par lot. Aucun des deux
  DAO n'a d'exigence propre à un lot.
- **H2** — `B03-QT-09` devient facultatif, remplacé par la règle `MATERIEL_EXIGE` (liste ou texte).
- **H3** — Le (d) « directeur de travaux ayant n ans » reste un champ à part. Au MTP, il recoupe le conducteur de travaux
  de la liste (5 ans), mais le document type en fait un critère distinct.

**Recette attendue** :
- **MTP** : les 10 engins avec nombres et minimums en propre, et les 2 postes avec leur domaine d'expérience. Le DPAO
  imprime les deux listes à la clause 6.3 (après la recopie du front). Un minimum supérieur au nombre donne un 400.
- **MEN** : 5 engins sans minimum, 2 postes `parLot`. Une fiche sans liste ni `B03-QT-09` est refusée par
  `MATERIEL_EXIGE`, et la révision copie les deux listes.

> ⚠️ **Livraison backend du 2026-10-03 — recette.**
> - `MoyensFicheTest` : les lignes du MTP (6 dont au moins 4 en propre, tout en propre) et du MEN (sans minimum, par
>   lot), le personnel (domaine, sigle, morceaux absents), les 400 (minimum 3 sur 2, désignation vide, nombre 0, poste
>   manquant, expérience négative).
> - `FicheDaoTravauxIntegrationTest.materielEtPersonnel`, sur le MEN en deux lots :
>   - `B13` servi aux travaux, pas aux fournitures ; 409 hors travaux ;
>   - 400 sur un minimum supérieur au nombre ;
>   - une fiche sans liste ni `B03-QT-09` est refusée par `MATERIEL_EXIGE` ;
>   - avec les 5 engins et les 2 postes par lot, elle se valide ;
>   - sur la version validée, 409 `FICHE_VALIDEE` ;
>   - la révision copie les deux listes.
> - L'impression par le DPAO attend votre recopie. Les 10 engins du MTP restent à saisir par la recette front.
> - **Livraison** : migration **V60** et script `docs/referentiel/2026-10-03-materiel-personnel-travaux.sql`, passé à blanc
>   sur DBPRS20 (16 valeurs de `B03-QT-09` y sont conservées). Les deux copies du fichier de correspondance des travaux
>   sont mises à jour à l'identique.

> ✅ **Front, 2026-10-03.**
> - **Écran** : l'écran est aligné sur la livraison. L'aperçu de chaque ligne suit vos règles d'impression, sigle en tête
>   du diplôme compris. Le bloc `B13` s'affiche sur une fiche de travaux, en lecture vérifiée sur la fiche 32.
> - **DPAO-T, clause 6.3 (c) et (e)**, rédigé dans `DPAO-T.txt` / `.json` (`verifier.mjs` : 284 sur 284). ⚠️ **Ne pas le
>   recopier encore** : le texte attend la validation du pilote.
>   - (c) : la phrase du document type, puis `{{MOYENS.materiel}}` si la liste est remplie, puis `{{B03-QT-09}}` s'il est
>     saisi ;
>   - (e) : « (e) proposer le personnel clé suivant : », si l'une des deux est remplie, puis `{{MOYENS.personnel}}`, puis
>     `{{B03-QT-13}}`.
> - **Une condition sur la liste est nécessaire**, comme vous le proposiez. Sans elle, une fiche qui décrit son matériel
>   en texte seul imprimerait des pointillés au-dessus de son texte (16 fiches sur DBPRS20 sont dans ce cas). Le modèle
>   écrit :
>   - `MATERIEL-LISTE` = `MOYENS.materiel renseigne` ;
>   - `PERSONNEL-LISTE` = `MOYENS.personnel renseigne` ;
>   - `PERSONNEL-CLE` = `MOYENS.personnel renseigne ou B03-QT-13 renseigne`.
>
>   **Demandé** : que le moteur de conditions lise `MOYENS.materiel` et `MOYENS.personnel` (« renseigne » = la liste a au
>   moins une entrée), et que `DEBUT_TERME` admette le point dans une clé. Côté front, l'évaluateur du banc est élargi à
>   `[\w.-]+` ; `lire.mjs` n'a pas changé (il ne déduit rien d'un « renseigne »), la parité de la lecture tient donc.
> - **Banc de l'import** : aucune fausse valeur. Le DPAO-T relit 2 champs de moins, `B03-QT-09` et `B03-QT-13`, désormais
>   signalés **ambigus** : chacun suit, dans la même cellule, un paragraphe fait du seul jeton de sa liste, et la lecture
>   ne peut pas savoir lequel des deux le DAO remplit. La lecture n'importe pas les listes : elles se saisissent à l'écran.
>
> ✅ **2026-10-03 — texte des (c) et (e) validé par le pilote.** `DPAO-T.txt` est **à recopier** tel que commité en
> `1216dd9`, avec la condition sur la liste (`MOYENS.x renseigne`) demandée ci-dessus.

> ⚠️ **Livraison backend du 2026-10-03 — conditions sur les listes.** Conforme à la demande.
> - Le moteur de conditions lit **`MOYENS.materiel`** et **`MOYENS.personnel`** (et `BESOIN.series`) comme leur jeton :
>   `renseigne` est vrai dès que la liste a une entrée, `vide` sinon.
> - Une clé de condition admet le point. `DEBUT_TERME` et les termes suivent la même clé :
>   `[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*`. C'est plus étroit que votre `[\w.-]+`, sans tiret hors des codes de
>   champ ; vos trois conditions passent.
> - **Essai à blanc** de votre `DPAO-T.txt` du jour, chargé puis retiré sans être livré : le modèle se lit, 49 conditions
>   déclarées (45 aujourd'hui).
> - **Test** `MoyensFicheTest.conditionsSurLesListes`, avec vos trois conditions sur un modèle réduit :
>   - une fiche au texte seul imprime son texte, sans pointillés au-dessus et sans « (e) » ;
>   - avec les listes, elle imprime les deux listes et le texte.
> - **DPAO-T non recopié**, comme demandé : j'attends la validation du pilote. Ni migration ni script.
>
> ✅ **Contre-recette du front, 2026-10-03 (JAR de 06:04) : fiche 32 révisée en v4** (écriture avec l'accord du
> pilote) :
> - **Écran** : les 10 engins et les 2 postes du MTP saisis dans le bloc `B13`. L'aperçu donne les lignes attendues
>   (« - Camions bennes ≥ 10 000 kg : 6, dont au moins 4 en propre », « - Niveleuse : 1, en propre »…). Les deux `PUT`
>   répondent 200, et la relecture est conforme : ordre, `minimumEnPropre`, domaine.
> - **Validation** : 0 bloquant, v4 VALIDEE.
> - **Attendu jusqu'à votre recopie** : le DPAO imprime encore, aux (c) et (e), les textes de `B03-QT-09` et `B03-QT-13`
>   sans les listes. **Je referai ce point après la recopie du DPAO-T et la condition `MOYENS.x renseigne`.**
