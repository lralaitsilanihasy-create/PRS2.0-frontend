# Demande backend — 2026-10-17 — L'import du DAO sépare deux valeurs voisines d'un même paragraphe

## Contexte

Le pilote a importé le 17/10 le DAO de la fiche « Fourniture de consomptibles informatiques (CONTRAT - CADRE) »
(ligne 303339). La revue annonce « 25 non trouvées ». Le front les a classées :

- **15 sont vides dans le DAO.** La remise des offres se fait sur papier, donc les 9 champs `B04-SE-…` de la remise
  électronique ne s'impriment pas. Les 6 autres sont des champs facultatifs laissés vides : devise, minimum du
  contrat-cadre, clauses libres.
- **7 ne sont pas imprimées**, parce que le cadrage exclut leur section : lot unique, plusieurs titulaires, marchés
  fractionnés, pas d'assurance, contrat reconductible.
- **3 sont imprimées mais non relues** : c'est l'objet de cette demande. Deux sont obligatoires, et la PRMP doit les
  ressaisir après l'import.

| Champ | Paragraphe du modèle AE-CC | Texte imprimé |
|---|---|---|
| `B02-SG-01` (obligatoire) et `B02-SG-02` | « … sur la base du présent contrat-cadre : {{B02-SG-01}} ({{B02-SG-02}}). » | « … : RANDRIANARIVO La Personne (Décision n° 031-MEF/SG du 6 janvier 2027). » |
| `B02-SG-03` (obligatoire) | « Représentée par : {{B01-AC-05}}, nommée par {{B02-SG-03}}. » | « Représentée par : RANDRIANARIVO La Personne, nommée par Arrêté n° 0457/2027-MEF du 4 janvier 2027. » |

L'import de la fiche « Fourniture d'articles de bureau (CONTRAT - CADRE) » (ligne 303337) donne le même résultat, sur
un DAO présenté autrement. La présentation n'y est donc pour rien.

**La cause est une règle voulue** (lot D3, 29/09, §B4.3, `LectureDao`) : un paragraphe qui porte plusieurs jetons ne
propose rien, parce que « tout donner au premier est une fausse valeur, et le séparateur ne découpe pas sûrement ». La
règle est juste en général. Cette demande ne l'abolit pas : elle ajoute deux cas où le découpage est **sûr**.

> ⚠️ **2026-10-17, réponse du backend : pour `B02-SG-01` à `SG-03`, la cause est ailleurs.** La règle §B4.3 ne vaut que pour
> les paragraphes faits **uniquement** de jetons et de ponctuation. Les deux paragraphes de l'AE-CC portent du texte fixe
> (« Personne responsable des marchés passés… », « Représentée par : … »). La lecture par motif les découpe déjà, en confiance
> haute : relus seuls, ils donnent les trois valeurs justes.
>
> La vraie cause est l'**accroche** de l'AE-CC :
> - Il commence par le même bloc d'autorité que le DPAC, qui le précède dans le DAO. Sa lecture s'accrochait à l'en-tête du
>   DPAC, puis ne retrouvait pas ses paragraphes suivants.
> - Elle ne se réancrait que loin après le préambule, sauté en bloc. Sur le DAO complet de la fiche 2 (v3), l'AE-CC
>   reconnaissait 157 paragraphes ; il en reconnaît 184.
> - **Correctif** : l'accroche est **confirmée**. Elle est gardée si deux des huit paragraphes suivants du modèle se retrouvent
>   juste après elle ; sinon, la lecture part de la première occurrence confirmée qui suit.
>
> B1 et B2 sont **livrés aussi**, là où la règle §B4.3 joue vraiment. Voir B1 et B2 ci-dessous.

## B1 — Couper sur une valeur déjà connue

Quand l'une des valeurs du paragraphe est **déjà connue** au moment de la lecture, on retire du texte lu cette valeur
et le texte fixe qui l'accompagne ; le reste revient à l'autre jeton. Une valeur est connue si elle vient :

- d'une reprise du plan de passation, comme `B01-AC-05` (PRMP) ou `B02-OB-01` (objet) ;
- ou d'une lecture de confiance haute ailleurs dans le même document.

La valeur connue doit se retrouver telle quelle, après normalisation, **au bord** du texte lu (au début si son jeton
est le premier, à la fin s'il est le dernier). Sinon, rien n'est proposé, comme aujourd'hui.

Cas couverts :
- `B02-SG-03` (AE-CC) : « RANDRIANARIVO La Personne » est la PRMP du plan.
- `B02-OB-03` dans « {{B02-OB-03}} — {{B02-OB-01}} » : CCAP-F, CCAP-T, CPS-PI, LETTRE-PI. L'objet vient du plan ; le
  numéro du DAO, qui est obligatoire, devient lisible.

> ⚠️ **2026-10-17, livré (B1)**, dans les paragraphes faits de deux jetons et de ponctuation (`LectureDao.voisines`).
> - **Valeurs connues** : les reprises du plan, que l'import passe désormais à la lecture (`valeursPpm`), ou une valeur lue en
>   confiance haute dans le même document. Une valeur connue doit se retrouver, normalisée, au bord du texte lu ; l'autre
>   valeur est le reste, sans le séparateur.
> - **Exemple de test** : « 07 — CC/MEF — Fourniture de papier », objet connu au plan, donne `B02-OB-03` = « 07 — CC/MEF ». Le
>   séparateur y figure deux fois, B2 seul n'aurait rien coupé.
> - **`B02-SG-03`** : il n'a pas besoin de B1, voir l'encadré du contexte.

## B2 — Couper sur un séparateur sans ambiguïté

Quand aucune des deux valeurs n'est connue, on coupe sur le **texte fixe** qui les sépare, à deux conditions :

1. ce texte fixe apparaît **exactement une fois** dans le texte lu entre les deux repères du paragraphe ;
2. chacune des deux parts est non vide, et chaque champ typé (date, montant, nombre) se lit selon son type.

Pour un séparateur fait de ponctuation seule (« ( », « ; », « , »), on ajoute une condition : une parenthèse ouvrante
n'est retenue que si la **parenthèse fermante** du modèle termine le texte lu (« X (Y) »).

Cas couverts :
- `B02-SG-01` et `B02-SG-02` (AE-CC), séparés par « ( » et refermés par « ) ».
- `B02-LT-06` et `B02-LT-07` (AE-T), séparés par « ; ».
- `B05-PF-06` et `B05-PF-07` (DPIC-PI), séparés par « qui sera dû lors de ».

Si le séparateur apparaît deux fois ou plus (par exemple un nom de PRMP contenant lui-même une parenthèse), rien n'est
proposé : c'est la règle actuelle.

> ⚠️ **2026-10-17, livré (B2)** tel que demandé :
> - le séparateur figure une seule fois ;
> - « ( » n'est retenu que si le modèle referme la parenthèse ;
> - les deux parts sont non vides, et chaque champ typé se lit selon son type ;
> - au-delà de deux jetons, rien n'est proposé.
>
> `B02-SG-01` et `B02-SG-02` passent en fait par la lecture par motif (texte fixe), en confiance haute. `B05-PF-06` et
> `B05-PF-07` sont dans le même cas, leur séparateur « qui sera dû lors de » portant des lettres. B2 sert les cas faits de
> ponctuation seule, comme `B02-LT-06` ; `B02-LT-07`.

## B3 — Une confiance « à vérifier », jamais cochée d'office

Une valeur obtenue par B1 ou B2 est proposée en confiance **moyenne**, avec son extrait comme les autres. Elle n'est
jamais cochée d'office : la PRMP la confirme d'un coup d'œil. Le contrat d'`ImportDaoResult` ne change pas.

> ⚠️ **2026-10-17, livré (B3)** : les valeurs de B1 et B2 sont en confiance moyenne. Celles que la lecture par motif retrouve
> grâce à l'accroche confirmée, dont `B02-SG-01` à `SG-03`, gardent la confiance de leur paragraphe : haute quand son texte
> fixe est assez long. Le contrat ne change pas.

## Mesure et recette

- **Les deux DAO de démonstration** (`Documents Types/Fournitures et services/ExemplesDAO/`, lignes 303339 et 303337) :
  `B02-SG-01`, `B02-SG-02` et `B02-SG-03` sont proposés, justes, en confiance moyenne. Le reste est inchangé : 0 fausse
  valeur.
- **Les cinq DAO réels de la mesure** (2463, 297, 6114, 6213, MTP Ankily), dont deux contrats-cadres du MEF :
  - aucune valeur nouvelle qui soit fausse ;
  - les valeurs nouvelles qui sont justes, indiquées dans la livraison.
- **Le DAO complet produit par l'application** (charte, version 3 de la ligne 303337) : mêmes résultats, et B1 rend
  lisible le numéro du DAO là où il est imprimé avec l'objet.

> ⚠️ **2026-10-17, mesure du backend.**
> - **DAO de démonstration** : non mesurés. Le dossier `ExemplesDAO` était vide sur le poste au moment de la mesure ; leur
>   recette revient au front.
> - **DAO complet de la fiche 2 (v3)**, extrait de DBPRS20 et de même forme : `B02-SG-01`, `SG-02` et `SG-03` sont proposés
>   justes, en confiance haute ; `SG-04` passe de moyenne à haute.
> - **Cinq DAO réels** :
>   - **une seule valeur nouvelle, juste** : `B09-OM-01` = « cinq (05) » (297, confiance haute, phrase entière du CCAP) ;
>   - **aucune valeur nouvelle fausse** ;
>   - **sept valeurs fausses retirées**, par deux gardes ajoutées à la mesure.
> - **Les deux gardes** :
>   - un intervalle qui contient un titre d'article ou de clause numérotée du document n'est pas une valeur. Cela retire trois
>     titres d'article lus comme valeurs (297 : `B05-VP-03`, `B09-DX-03`, `B09-AS-02`) et deux débordements sur l'article
>     suivant (MTP : `B09-VQ-01`, `B10-PC-01`) ;
>   - un trou du modèle (« <insérer … > ») n'est pas une valeur. Cela retire `B02-SG-04` = « <insérer les nom et prénom(s) du
>     signataire> » sur 6114 et 6213.
> - **Reprises du plan** : l'accroche ajoute quelques lectures (`B01-AC-01`, `B01-AC-02` sur le 297 et le MTP). Elles servent
>   seulement à la comparaison avec le plan, jamais à une proposition.
> - **Parité de la lecture des tableaux** : inchangée (136 articles).
>
> **Pour le front** : `lire.mjs` doit reprendre les trois changements pour garder la parité : l'accroche confirmée, B1/B2
> (`voisines`) et les deux gardes.

## Ce que le front fera, dès la livraison

- Rien à développer à l'écran : les nouvelles propositions passent par la revue actuelle.
- Recette sur les deux DAO de démonstration, puis report du résultat dans cette demande.

## Recette du front, 17/10 (backend b7e3400) : demande close

**Import du serveur sur les deux DAO de démonstration**, en lecture seule, sur la fiche « Fourniture de consomptibles
informatiques » (ligne 303339, en brouillon) :

| DAO | AE-CC reconnus | Valeurs proposées | Fausses | Non trouvées | `B02-SG-01` à `SG-03` |
|---|---|---|---|---|---|
| Consomptibles informatiques (ligne 303339) | 218 / 278 | 73 | 0 | 22 (au lieu de 25) | proposés, justes, confiance haute |
| Articles de bureau (ligne 303337) | 192 / 278 | 72 | 0 | 23 | proposés, justes, confiance haute |

`B02-SG-04` passe aussi en confiance haute, juste.

Les deux DAO n'étaient pas dans `ExemplesDAO` au moment de la mesure du backend : le dossier avait été vidé sur le poste.
Ils ont été relus depuis leurs copies de génération, identiques.

**Parité de `scripts/import-dao/lire.mjs`.** Les trois changements sont reportés :
- l'accroche confirmée (`premiereAccroche`) ;
- B1 et B2 (`voisines`) ;
- les deux gardes : le titre de clause (`titreDeClause`), qui écarte aussi le jeton ailleurs, et le trou du modèle dans
  `valeurSaisie`.

Ils sont mesurés sur les huit DAO de référence (avant / après) :
- **paragraphes reconnus de l'AE-CC**, identiques au serveur : 157 → 184 sur le DAO complet (ligne 303337, version 3),
  192 → 218 et 164 → 192 sur les deux DAO de démonstration ;
- **effets identiques à ceux annoncés par le backend** :
  - 297 : `B09-OM-01` = « cinq (05) » ajouté, juste ; `B05-VP-03`, `B09-DX-03` et `B09-AS-02` retirés (titres d'article) ;
  - MTP : `B09-VQ-01` et `B10-PC-01` retirés ;
  - 6114 et 6213 : `B02-SG-04` = « <insérer … > » retiré ;
  - reprises du plan `B01-AC-01` et `B01-AC-02` ajoutées sur 297 et MTP, pour la comparaison seulement ;
- **lecture des champs des deux DAO de démonstration** : 40 sur 40 au DPAC-CC, 37 sur 37 et 35 sur 35 à l'AE-CC, au lieu de
  32 et 29 ;
- **`test_voisines.mjs`** : les quatre cas de `LectureDaoVoisinesTest` rejoués sur `lire.mjs`, tous verts ;
  `test_reprojection.mjs` reste vert.

`lire()` prend désormais les reprises du plan en quatrième argument (`connues`), comme `LectureDao.lire`.
