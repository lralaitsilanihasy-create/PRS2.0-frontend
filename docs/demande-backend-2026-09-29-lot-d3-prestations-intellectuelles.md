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

> ⚠️ **Livraison backend du 2026-09-29 (§B1).** Conforme. Les trois fichiers sont recopiés tels quels (`modeles/dao/`),
> avec 33, 17 et 30 conditions. `ModelesDao.COUVERTURES` les associe à la quantité fixe et au marché à commande des
> prestations intellectuelles, types `DPIC`, `CCAP` et `AE`. Le comparateur donne 230/230, 300/300 et 238/238 sur le
> rendu brut du serveur ; les cinq autres modèles restent identiques. La formule en `}}` est rendue telle quelle
> (`ModelesDaoPrestationsIntellectuellesTest`, cas des prix révisables). Le libellé du DPIC reste « Données particulières
> des instructions aux consultants », celui du lot 2a ; le titre imprimé est celui du modèle (« … aux candidats »).

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

> ⚠️ **Livraison backend du 2026-09-29 (§B2.1).** Les sept codes proposés sont gardés : aucun ne heurte un code existant,
> et leurs rubriques existent (V42). Deux écarts :
> - **Pas de condition au référentiel pour `B05-PF-13`, `B06-CS-02` et `B06-CS-03`.** Une condition de champ ne lit que
>   le cadrage, pas un autre champ comme `B02-MS-01`. Ces trois champs sont donc servis sans condition et **facultatifs** :
>   obligatoires, ils bloqueraient une fiche d'un autre mode de sélection. Les conditions du DPIC choisissent, elles, ce
>   qui s'imprime. `B06-TP-07` est aussi facultatif. `B04-EP-04` est obligatoire, comme `B04-EP-03`.
> - **Les bornes des poids (T entre 0,6 et 0,8, F entre 0,2 et 0,4, T + F = 1) et du délai (≥ 6 jours) ne sont pas
>   contrôlées par le serveur.** Aucune règle du catalogue ne les porte, et la demande n'en crée pas. Ce serait une
>   règle nouvelle à demander, facile à ajouter.
>
> `B08-AI-03` porte la condition `avance = OUI` et le rôle `AVANCE_MAX_20:TAUX`. Nombres décimaux : « 0,8 » se saisit
> avec la virgule ou le point, se range « 0.8 » et s'imprime « 0,8 » (`NOMBRE` décimal).

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

> ⚠️ **Livraison backend du 2026-09-29 (§B2.2).** Les sept corrections sont faites (fichier de correspondance et
> `docs/referentiel/2026-09-29-lot-d3-prestations-intellectuelles.sql`). Quatre précisions :
> - **1. `B02-MS-01` : le format des options change, pas seulement la donnée.** Les options étaient séparées par des
>   virgules, en base comme au fichier de correspondance, et une option à virgule ne pouvait pas s'écrire. Désormais,
>   quand une option contient une virgule, le séparateur est `|` : `Qualité technique, expérience et proposition
>   financière|Budget prédéterminé…|…`. Sans `|`, rien ne change pour les autres listes. Le serveur sert quatre options.
>   Aucune fiche ne portait une moitié d'option : DBPRS20 est vide depuis le vidage du 29/09, comptage à 0 dans le script.
> - **4. Intérêts moratoires** : `INTERETS_MORATOIRES_TAUX` lit un `TAUX` de type `NOMBRE` comme une majoration en
>   points, exigée d'au moins un point, sans taux de la Banque centrale à comparer. Les autres catégories gardent leur
>   pourcentage.
> - **5. Pénalités** : `B09-PP-01` est retiré. Le reflet `B09-PR-01` de la question `penalites` n'était servi qu'aux
>   fournitures : la migration **V53** l'ouvre aux prestations intellectuelles, pour que la fiche pose la question dont
>   le CPS dépend. `PENALITES_PLAFOND_15` compare désormais au plafond de la catégorie (10 % pour les PI, 15 % ailleurs).
>   Le code de la règle est stable, le message dit le plafond. Aucun champ PI ne porte plus le rôle `TAUX` de cette
>   règle, puisque le CPS laisse le plafond en blanc : elle vaudra dès qu'un champ le portera. L'« aide du cadrage » (le
>   texte de la question) est côté front : il faut y dire 10 % pour les PI.
> - **7. `B09-DP-01` en `OUI_NON` : la condition du modèle ne convient plus.** `DEPART-OS` (AE et CPS) vaut
>   `B09-DP-01 renseigne` ; avec un oui/non, la réponse « NON » est aussi renseignée et imprimerait « le délai court de
>   l'ordre de service ». **À corriger dans les modèles : `B09-DP-01 = OUI`.** En attendant, le champ est facultatif :
>   le laisser vide vaut « non ».

### B2.3 — À confirmer par le pilote avant exécution (même règle que les fournitures le 29/09)

Aucun document PI ne les imprime ; la règle arbitrée pour les fournitures (retirer pour la catégorie, **après**
vérification qu'aucune règle serveur ne les lit) leur conviendrait :

- blancs **du candidat** dans l'AE (Q12) : `B03-TP-01` à `-05`, `B03-SP-03`, `B03-NP-01`, `B08-AI-02` ;
- **sans place** : `B02-CL-03`, `B09-DP-02`, `B04-QT-01`, `B04-QT-02`, `B06-TP-01` (le total 100 est écrit en dur),
  `B06-OF-01`, `B06-CS-01`, `B05-PF-02` (remplacé par `B05-PF-13`).

Le front les soumet au pilote ; le backend ne les touche pas avant sa réponse.

> ⚠️ **Livraison backend du 2026-09-29 (§B2.3).** Non touché, comme demandé. Le contrôle des règles serveur qui les
> liraient sera fait à la réponse du pilote, comme pour les fournitures.

## B3 — Production

Une fiche PI validée produit **DPIC, AE et CPS** au format du document type (au lieu des listes « libellé : valeur »), avec
les règles de D2 : jetons vides en pointillés, marqueurs de cellule et de rangée, `.chiffres` sans unité en double.

> ⚠️ **Livraison backend du 2026-09-29 (§B3).** Conforme. Une fiche PI validée produit DPIC, CPS (type `CCAP`, libellé
> « Cahier des prescriptions spéciales ») et AE depuis les modèles. Vérifié par `FicheDaoPrestationsIntellectuellesIntegrationTest`
> et, cas par cas, par `ModelesDaoPrestationsIntellectuellesTest`, qui couvre les quatre grands cas du B5.

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

> ⚠️ **Livraison backend du 2026-09-29 (§B4).** Conforme. Les trois règles sont portées dans `LectureDao`. La parité avec
> `lire.mjs` (522ed99) est vérifiée sur cinq entrées : `.docx` et PDF du contrat-cadre de la fiche 27, PDF réel du 2463,
> rendus bruts D2 et PI. L'extraction est identique, et la lecture aussi aux conflits de cadrage près (écart du 28/09).

## B5 — Tests attendus

- les trois modèles recopiés : rendu ≡ modèle (230, 300, 238 unités) ;
- une fiche PI par grand cas : qualité-coût + forfait + révisable + avance ; qualité seule + temps passé ; moindre coût +
  pourcentage (barème de la profession) ; budget prédéterminé + budget disponible ;
- la formule en `}}` rendue telle quelle ;
- `B02-MS-01` servi avec quatre options ;
- les trois règles de lecture (B4), chacune par un cas qui échouait avant.

> ⚠️ **Livraison backend du 2026-09-29 (§B5).** Conforme.
> - Rendu ≡ modèle : 230, 300 et 238 unités au comparateur ; `ModelesDaoTest` charge les huit modèles.
> - Quatre cas de fiche : qualité-coût, forfait, révisable et avance ; qualité seule et temps passé ; moindre coût et
>   barème ; budget prédéterminé et budget disponible. Tous dans `ModelesDaoPrestationsIntellectuellesTest`, avec la
>   formule en `}}`, les poids « 0,8 » / « 0,2 », le plafond de 10 % et les intérêts en points.
> - `B02-MS-01` à quatre options : `FicheDaoPrestationsIntellectuellesIntegrationTest`, sur le référentiel servi.
> - Les trois règles de lecture : `LectureDaoTest#reglesDuLotD3`. Rejoué sur la version précédente du lecteur, il échoue
>   sur les trois cas : `B04-EP-03` en haute, `B02-OB-02` qui avale la phrase suivante, `B02-OB-03` proposé.

## Pour le juriste (pas pour le backend)

Coquilles du document type reproduites telles quelles (Q14) : « clause 6.2.1 des DPIC » (AE, la clause est 7.2.2),
« indiqué dans les DPAO » (IC), « article 160 du CCAG » (CPS art. 16), « montant total des travaux » et « objet et lieu
d'exécution des travaux » (CPS), « Maître d'œuvre » (CPS art. 6), sommaire PF1-PF5 contre PF1-PF6. Et deux questions :
la forme du groupement imposée par le CPS art. 3 (solidaires ou conjoints) contre le cadrage (« au choix » / « solidaire
obligatoire »), et l'arbitrage CNUDCI seul proposé au CPS art. 20 (Q5, Q10).

## B6 — Complément du 29/09 (suite de la livraison) : recopier AE-PI et CPS-PI

Suite de l'encadré §B2.2, point 7 : `B09-DP-01` étant un `OUI_NON`, la condition `DEPART-OS` des deux modèles devient
**`B09-DP-01 = OUI`** (un « Non » imprimait la phrase). Recopier `scripts/modeles-dao/modeles/AE-PI.txt` et
`CPS-PI.txt` (fidélité inchangée, 300/300 et 238/238 ; décalques dans `docs/modeles-dao/`). Rien d'autre ne change.
Le champ peut redevenir obligatoire si le pilote le souhaite : « Non » ne s'imprime plus.

Fait côté front le même jour :
- l'aide de la question des pénalités dit le plafond par catégorie (« 15 % ; 10 % pour les prestations
  intellectuelles ») ;
- **PI-2** : l'import du DAO est ouvert aux prestations intellectuelles (quantité fixe et à commande), miroir de
  `ModelesDao.COUVERTURES` ; un contrat-cadre de PI reste fermé ;
- l'écran d'administration des champs relit et renvoie les options au nouveau format (« | » dès qu'une option contient
  une virgule) : avant, modifier `B02-MS-01` l'aurait recoupée en deux.

Reste ouvert, **à décider par le pilote** : une règle serveur sur les bornes des poids (T entre 0,6 et 0,8, F entre 0,2
et 0,4, T + F = 1) et du délai de réponse (≥ 6 jours) — l'encadré §B2.1 la dit facile à ajouter ; et le §B2.3.

## Ce que le backend rend

Commit(s) qui referment B1 à B5, script du référentiel pour DBPRS20 (B2.1, B2.2 ; B2.3 après le pilote), tests, et un
encadré ⚠️ daté ici pour tout écart.
