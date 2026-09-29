# Demande backend — Lot D3 (PI-1) : les DAO de prestations intellectuelles produits et importés

**Date** : 2026-09-29 · **Émetteur** : front · **Plan** : `docs/plan-2026-09-29-lot-d3-prestations-intellectuelles.md`
(arbitrage du pilote du 29/09 : Q1 le DPIC = le tableau seul, Q3 cinq totaux + trois champs, Q14 décalque fidèle ; les
autres questions suivent la recommandation du plan) · **Analyse** : `docs/analyse-2026-09-29-documents-types-pi.md`.

Même chaîne que D1 (contrat-cadre) et D2 (fournitures) : le front a décrit les trois documents types ARMP des PI en
modèles à trous, le serveur les recopie, les produit à la validation d'une fiche PI, et l'import du DAO (Word et PDF) les
lit. **Aucune extension du moteur** : marqueurs de paragraphe, de cellule et de rangée, `.chiffres`, conditions `=`,
`!=`, `contient`, `renseigne`, `vide` suffisent.

## B1 — Recopier les trois modèles et les couvrir

| sigle | document | source ARMP | paragraphes | conditions | fidélité (`verifier.mjs`) |
|---|---|---|---|---|---|
| `DPIC-PI` | Données particulières des instructions aux candidats | doc 2 (le tableau 1.3 seul) | tableau de 25 rangées | 33 | 230 / 230 |
| `AE-PI` | Acte d'engagement | doc 4 | 241 | 17 | 300 / 300 |
| `CPS-PI` | Cahier des prescriptions spéciales (rôle du CCAP) | doc 5 | 171 | 30 | 238 / 238 |

- Fichiers : `scripts/modeles-dao/modeles/{DPIC-PI,AE-PI,CPS-PI}.txt` ; décalques de relecture
  `docs/modeles-dao/{DPIC-PI,AE-PI,CPS-PI}.docx`.
- `ModelesDao.COUVERTURES` : les trois sigles pour `QUANTITE_FIXE` **et** `A_COMMANDE`, catégorie
  `PRESTATIONS_INTELLECTUELLES`. Le DPIC tient la place du DPAO (V42 : remappage `DPAO → DPIC` de cette catégorie).
- Les IC (doc 1) et le CCAG (doc 6) sont joints tels quels, comme aux fournitures ; les **Termes de référence** sont une
  pièce téléversée par l'acheteur (arbitrage Q11) : le CPS n'en garde que le titre.
- **La formule du CPS qui finit par `}}`** (« {ou Rl= Rlo X [ 0,15+0,85 Il/Ilo] }} », annexe de révision) : vérifié, le
  motif des jetons exige `{{` — elle n'est pas prise pour un jeton. Un test s'en assure (le rendu la contient telle quelle).

## B2 — Le référentiel des champs PI

### B2.1 — Sept champs à créer

| code proposé | libellé | type | document | condition | note |
|---|---|---|---|---|---|
| `B04-EP-04` | Délai de réponse de la PRMP aux demandes d'éclaircissement (jours) | NOMBRE | DPIC | — | ≥ 6 jours (texte du modèle) |
| `B05-PF-13` | Budget disponible (Ariary) | MONTANT | DPIC | `B02-MS-01` = budget prédéterminé | Q4 : distinct du « montant du forfait » |
| `B06-TP-07` | Score technique minimum (points) | NOMBRE | DPIC | — | Q3 |
| `B06-CS-02` | Poids de la proposition technique (T) | NOMBRE décimal | DPIC | mode qualité-coût | entre 0,6 et 0,8 (Q3) |
| `B06-CS-03` | Poids de la proposition financière (F) | NOMBRE décimal | DPIC | mode qualité-coût | entre 0,2 et 0,4 ; T + F = 1 |
| `B08-AI-03` | Taux de l'avance forfaitaire (%) | POURCENTAGE | CCAP | `avance = OUI` | la fiche PI n'avait que la question du cadrage ; rôle `TAUX` de `AVANCE_MAX_20` |
| `B09-OP-02` | Délai des opérations de vérification (jours) | NOMBRE | CCAP | — | facultatif : sans valeur, les 30 jours du CCAG |

Les codes sont une proposition : le backend les ajuste s'ils heurtent un code existant, et le dit dans l'encadré.
Nombres décimaux : « 0,8 » doit se saisir et s'imprimer avec la virgule.

### B2.2 — Corrections

1. **`B02-MS-01` (mode de sélection) : une option coupée en deux par sa virgule.** Le serveur sert aujourd'hui
   `["Qualité technique", "expérience et proposition financière", …]` — cinq options au lieu de quatre. L'option est
   « Qualité technique, expérience et proposition financière ». Les conditions du modèle visent « expérience », qui marche
   sur l'option corrigée. Les fiches qui portent l'une des deux moitiés sont à signaler.
2. **`B04-LP-01` (langue)** : ajouter l'option « Une autre langue que le français » (DPIC 7.3, Q6).
3. **`B04-LH-02` (date et heure limites)** : `DATE` → `DATE_HEURE` (le DPIC exige l'heure, Q15).
4. **`B08-IP-01` (intérêts moratoires)** : le CPS écrit « taux directeur … augmenté de <n> point(s) » ; le champ devient
   un **nombre de points** (`NOMBRE`), et le contrôle `INTERETS_MORATOIRES_TAUX` en tient compte pour les PI (Q8).
5. **Pénalités** : le modèle suit le cadrage `penalites` (comme ailleurs) ; `B09-PP-01` est **retiré** (Q7). Le plafond
   du CCAG des PI est de **10 %** : le contrôle du plafond (`PENALITES_PLAFOND_15` et l'aide du cadrage) se règle **par
   catégorie**.
6. **`B09-FC-01`** (documents du matériel fourni par le consultant) : **réactivé**, facultatif — l'art. 14 du CPS ne
   s'imprime que s'il est renseigné (Q9).
7. **`B09-DP-01`** (point de départ) : le modèle l'emploie comme interrupteur (« le délai court de l'ordre de service de
   commencer », AE 5.1 et CPS art. 15). Proposé : `OUI_NON` « Le délai court de l'ordre de service de commencer ».

### B2.3 — À confirmer par le pilote avant exécution (même règle que les fournitures le 29/09)

Aucun document PI ne les imprime ; la règle arbitrée pour les fournitures (retirer pour la catégorie, **après**
vérification qu'aucune règle serveur ne les lit) leur conviendrait :

- blancs **du candidat** dans l'AE (Q12) : `B03-TP-01` à `-05`, `B03-SP-03`, `B03-NP-01`, `B08-AI-02` ;
- **sans place** : `B02-CL-03`, `B09-DP-02`, `B04-QT-01`, `B04-QT-02`, `B06-TP-01` (le total 100 est écrit en dur),
  `B06-OF-01`, `B06-CS-01`, `B05-PF-02` (remplacé par `B05-PF-13`).

Le front les soumet au pilote ; le backend ne les touche pas avant sa réponse.

## B3 — Production

Une fiche PI validée produit **DPIC, AE et CPS** au format du document type (au lieu des listes « libellé : valeur »), avec
les règles de D2 : jetons vides en pointillés, marqueurs de cellule et de rangée, `.chiffres` sans unité en double.

## B4 — Import : trois règles de lecture ajoutées le 29/09 (à reporter dans `LectureDao`)

Mesurées sur le banc synthétique (`scripts/import-dao/banc.mjs`, qui remplace les fiches 27 et 16 disparues avec le
vidage) : huit modèles, sans bruit et sur douze graines de bruit. `lire.mjs` les porte :

1. **Jumeaux** : un paragraphe dont un autre paragraphe du modèle a le même texte fixe (« {{B04-EP-03}} jours avant la
   date limite… » / « {{B04-EP-04}} … ») ne donne **jamais la confiance haute** — quand l'un n'est pas reconnu, l'autre
   prend sa place (fausse valeur haute mesurée sur le DPIC bruité).
2. **Coupe même après un texte fixe final** : la coupe d'une valeur au début d'un paragraphe suivant du modèle vaut aussi
   quand le paragraphe finit par du texte fixe (« … est {{B02-OB-01}}. ») ; le texte fixe final revient au reste relu.
   Constat : l'AE du **contrat-cadre**, graine 6, rendait une fausse valeur haute (valeur fusionnée avec deux phrases).
3. **Plusieurs jetons séparés de ponctuation seule** (« {{B02-OB-03}} — {{B02-OB-01}} ») : rien n'est proposé.

Effet sur les vrais fichiers restants (DPAC et AE du contrat-cadre en `.docx` et PDF, le 2463 en PDF) : identique, sauf
le 2463 où une valeur qui avalait la suite de sa phrase passe de *haute* à *moyenne*, coupée.

Mesure de l'import sur les modèles PI (banc) : DPIC-PI 96 %, AE-PI 100 %, CPS-PI 65 à 77 % sans bruit — ce qui manque
au CPS est l'objet et la référence repris du plan (jamais proposés) et les termes de paiement (trois rédactions sans
texte fixe, signalées ambiguës). Critère Q10 tenu partout.

## B5 — Tests attendus

- les trois modèles recopiés : rendu ≡ modèle (230, 300, 238 unités) ;
- une fiche PI par grand cas : qualité-coût + forfait + révisable + avance ; qualité seule + temps passé ; moindre coût +
  pourcentage (barème de la profession) ; budget prédéterminé + budget disponible ;
- la formule en `}}` rendue telle quelle ;
- `B02-MS-01` servi avec quatre options ;
- les trois règles de lecture (B4), chacune par un cas qui échouait avant.

## Pour le juriste (pas pour le backend)

Coquilles du document type reproduites telles quelles (Q14) : « clause 6.2.1 des DPIC » (AE, la clause est 7.2.2),
« indiqué dans les DPAO » (IC), « article 160 du CCAG » (CPS art. 16), « montant total des travaux » et « objet et lieu
d'exécution des travaux » (CPS), « Maître d'œuvre » (CPS art. 6), sommaire PF1-PF5 contre PF1-PF6. Et deux questions :
la forme du groupement imposée par le CPS art. 3 (solidaires ou conjoints) contre le cadrage (« au choix » / « solidaire
obligatoire »), et l'arbitrage CNUDCI seul proposé au CPS art. 20 (Q5, Q10).

## Ce que le backend rend

Commit(s) qui referment B1 à B5, script du référentiel pour DBPRS20 (B2.1, B2.2 ; B2.3 après le pilote), tests, et un
encadré ⚠️ daté ici pour tout écart.
