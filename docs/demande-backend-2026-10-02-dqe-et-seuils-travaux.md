# Demande backend — Fiche DAO des travaux : le DQE dans la fiche, et des seuils de qualification calculés

**Date** : 2026-10-02 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-02-fiche-travaux-structuree.md`
(chantier b), arbitré par le pilote le 02/10 : lots 1 et 2, dans cet ordre (Q1). Les recommandations Q2 à Q5 sont
retenues :
- Q2 : saisie du DQE dans une grille, avec « coller depuis le tableur », sans import de fichier ;
- Q3 : découpage du forfait **dérivé** des chapitres du DQE ;
- Q4 : les anciens champs texte restent en complément ;
- Q5 : la plateforme de dépôt reste hors périmètre.

**Les deux cas réels** (fiches des faits, DAO non suivis : filigranes nominatifs) :
- **MEN, bâtiment scolaire** (`docs/jeu-donnees-men-travaux-faits.md`) : prix global et forfaitaire ; 2 lots au DQE
  identique ; **57 articles** en 12 chapitres numérotés `0` à `11`, prix numérotés `0.1`, `1.2`… ; unités `fft`, `m²`,
  `m³`, `kg`, `ml`, `U` ; quantités à deux décimales (`332,18`).
- **MTP, entretien routier** (`docs/jeu-donnees-mtp-routier-faits.md`) : prix unitaires ; **17 articles** en 3 séries
  (`000` installation, `500` ouvrages, `600` chaussées), prix numérotés `001`, `529`… ; prix unitaires écrits **en
  lettres** au bordereau (« Le mètre cube à : …… Ariary », les lettres font foi) ; le prix `001` est **plafonné à
  10 % du montant des travaux** ; sous-détail exigé pour `001`.

Rien n'est inventé ici sur votre modèle : les noms de propriétés et les codes de champs sont des **propositions** à
votre main. Les exemples sont tirés des deux DAO.

---

## B1 — Le DQE : le besoin ouvert aux travaux

### B1.1 — La ressource

`GET|PUT /api/fiches-marche/{idDmc}/articles` sert aujourd'hui les fournitures seulement (409 `BESOIN_HORS_PERIMETRE`
sinon). **Demandé** : l'ouvrir à la catégorie **TRAVAUX**. Même cycle de vie : version de fiche, figée à la
validation, copiée à la révision ; même `PUT ?lot=`, qui remplace le lot.

Le bloc `B12` « Besoin » (`rendu = 'BESOIN'`) entre au référentiel des travaux. Proposition d'intitulé pour les
travaux : « Détail quantitatif et estimatif ».

> ⚠️ **Livraison backend du 2026-10-02 (§B1.1, V59).** Conforme. `GET|PUT|DELETE …/articles` s'ouvre à TRAVAUX, avec le
> même cycle de vie ; `BESOIN_HORS_PERIMETRE` ne vise plus que les prestations intellectuelles. Le bloc `B12` est servi
> aux travaux avec une **rubrique propre, `B12-DQ`** : « Détail quantitatif et estimatif, par lot ». L'intitulé du bloc
> reste « Besoin », et les fournitures gardent `B12-BE`.
> **Écart :** le DQE vaut pour les **trois** types de marché des travaux, contrat-cadre compris, comme le besoin des
> fournitures ; une fiche de travaux en contrat-cadre exige donc aussi son DQE.

### B1.2 — Ce qu'un article de travaux porte de plus

| propriété (proposée) | type | exemple MEN | exemple MTP | règle |
|---|---|---|---|---|
| `numeroPrix` | texte ≤ 10 | `2.4` | `529` | obligatoire aux travaux ; **unique dans le lot** (400 `articles[i].numeroPrix`) |
| `serie` | texte ≤ 10 | `2` | `500` | obligatoire aux travaux ; regroupe les articles |
| `serieLibelle` | texte ≤ 200 | (intitulé du chapitre au DQE) | « Ouvrages » | même `serie` ⇒ même libellé dans le lot (400 sinon) ; un seul article de la série suffit à le porter, le serveur le recopie |
| `libelleBordereau` | texte ≤ 200, facultatif | — | « Le mètre cube » | prix unitaires seulement ; l'écran le **propose** d'après l'unité (`m³` → « Le mètre cube »), la PRMP le corrige (le DAO du MTP écrit « Le mètre carré » pour un prix en m³ : écart §7.1 de sa fiche des faits) |
| `sousDetail` | booléen, défaut `false` | — | `true` pour `001` | « prix soumis à sous-détail » (annexe 3 de l'AE) |
| `plafond` | pourcentage 0-100, facultatif | — | `10` pour `001` | « au plus n % du montant des travaux » |

- **Les existants restent** : `designation`, `unite`, `quantite`, ainsi que `quantiteMin` / `quantiteMax` pour un marché
  de travaux à commande. Pour les **caractéristiques**, voir B1.4.
- **Quantités décimales** : les deux DAO ont des quantités à deux décimales (`2 054,50` m³, `48 240,00` kg). Merci de
  confirmer que `quantite` les accepte. Sinon, il faut un décimal à deux chiffres après la virgule.
- **Ordre** : inchangé, c'est la position dans la liste. L'écran présente les articles groupés par série, dans l'ordre
  de leur première apparition.
- Hors travaux, ces propriétés sont ignorées, ou refusées en 400 si vous préférez. Le besoin des fournitures ne change
  pas.

> ⚠️ **Livraison backend du 2026-10-02 (§B1.2).** Conforme, avec les noms proposés : `numeroPrix`, `serie`,
> `serieLibelle`, `libelleBordereau`, `sousDetail`, `plafond`. Les règles d'écriture sont celles du tableau, 400 nominatif
> compris ; le plafond va de 0 à 100. **H1 :** les quantités passent à deux décimales (`numeric(15,2)`), pour toutes les
> catégories. Elles sont servies sans zéro inutile (`5`, `2054.5`) ; trois décimales donnent un 400. **Hors travaux**, ces
> propriétés sont **ignorées** et servies vides (`null`, `false`), sans 400 : l'écran peut envoyer la même forme partout.

### B1.3 — Les documents produits

À la validation d'une fiche de travaux qui a un DQE, **par lot** :

- **`BP` en xlsx**, intitulé « Bordereau des prix et détail quantitatif et estimatif », sur le modèle du bordereau des
  fournitures. Les cellules se répartissent ainsi :
  - **verrouillées** : n° de prix, désignation, unité, quantité ;
  - **ouverte** : la colonne « Prix unitaire HT » ;
  - **en formules** : montant par article, **sous-total par série**, une **récapitulation par série** en pied
    (MTP : « 000, 500, 600 »), total HT, TVA (`FICHE_TAUX_TVA`) et TTC ;
  - **prix unitaires ou mixtes** : une colonne ouverte de plus, « Prix unitaire en toutes lettres », puisque les
    lettres font foi ; la colonne « libellé du bordereau » en tête de ligne (« Le mètre cube à : ») ;
  - **article plafonné** : une cellule de contrôle en formule, « 001 : 10 % au plus du montant des travaux — respecté /
    dépassé ». Elle informe le candidat sans rien bloquer ; c'est la Commission qui écarte.
- **Liste des prix soumis à sous-détail** : une seconde feuille du même classeur (n° de prix, désignation), avec la
  formule du DAO en en-tête si vous la tenez (MTP : « prix = D × K1 / R »). À défaut, la seule liste.
- **Pas de `LF` ni de `TC`** aux travaux : la liste des fournitures et le tableau de conformité n'ont pas d'équivalent
  (les spécifications techniques des travaux sont une pièce rédigée, hors fiche).
- L'annexe 1 de l'AE-T reste le **cadre** qu'elle est (sections `ANNEXE-FORFAIT`, `ANNEXE-UNITAIRES`, `ANNEXE-MIXTE`) :
  le DQE chiffré est le classeur.

> ⚠️ **Livraison backend du 2026-10-02 (§B1.3).** Conforme. Le classeur `BP` des travaux, par lot :
> - colonnes « N° de prix, Désignation, Unité, Quantité (à commande : minimum et maximum), Prix unitaire HT, Montant HT » ;
> - à prix **unitaires ou mixtes** (cadrage `typePrix`), deux colonnes avant le prix : « Libellé du bordereau »
>   (« Le mètre cube à : »), verrouillée, et « Prix unitaire en toutes lettres », ouverte ;
> - par série : un intertitre (code, intitulé), les articles, puis « Sous-total série 500 — Ouvrages » ;
> - en pied : « Récapitulation » (une ligne par série, renvoyant à son sous-total), puis total HT, TVA et TTC ;
> - un article plafonné reçoit une ligne de contrôle en formule sous les totaux : « 001 : 10 % au plus du montant des
>   travaux — respecté / dépassé ». Elle est jugée sur le **total HT** (à commande : les montants maximum) et ne bloque
>   rien.
>
> Seuls le prix HT et le prix en lettres sont ouverts ; la feuille est protégée sans mot de passe, comme celle des
> fournitures. La seconde feuille « **Prix soumis à sous-détail** » (n° de prix, désignation, unité) n'existe que s'il y en
> a. **La formule « prix = D × K1 / R » n'est pas tenue** : la liste seule. **Ni `LF` ni `TC`** aux travaux. L'annexe 1
> de l'AE-T reste le cadre.

### B1.4 — Les contrôles

- **`BESOIN_INCOMPLET` aux travaux** (bloquant) : chaque lot a au moins un article, et chaque article a un numéro de
  prix, une série, une unité et une quantité positive. **La caractéristique exigée n'est pas demandée** aux travaux : le
  DQE n'en a pas, et les spécifications techniques sont une pièce à part. Les caractéristiques restent possibles, sans
  être exigées.
- **Pas de contrôle de plafond** à la fiche : les prix n'y sont pas.

> ⚠️ **Livraison backend du 2026-10-02 (§B1.4).** Conforme, **H3** comprise. `BESOIN_INCOMPLET` aux travaux exige, pour
> chaque article : un numéro de prix, une série, une unité et une quantité **positive**. À commande, c'est la quantité
> maximum qui doit être positive. Message : « L'article n° 1.2 du lot 1 (« Remblais ») n'a pas de quantité positive. »
> Pas de caractéristique exigée, pas de contrôle de plafond à la fiche.

### B1.5 — Le découpage du forfait, dérivé des séries (Q3)

Aujourd'hui, `B08-MR-06` (TEXTE_LONG, « un poste par ligne, avec son pourcentage ») s'imprime au CCAP-T, article 16.
Les pourcentages sont ceux du **candidat** : le MEN les laisse en blanc (fiche des faits, `B08-RE-01`).

**Demandé** :
- un jeton **`{{BESOIN.series}}`**, une ligne par série du lot : « `500` — Ouvrages : …… % » ;
- en marché non alloti, les séries de l'unique besoin ; en alloti, celles du lot 1, ou une liste par lot si
  l'article 16 se lit par lot (à vous de dire) ;
- **`B08-MR-06` désactivé pour les travaux.** Je recopierai le CCAP-T sur le nouveau jeton dès que vous me direz sa
  forme.

> ⚠️ **Livraison backend du 2026-10-02 (§B1.5).** `{{BESOIN.series}}` est servi, **sur une ligne par série**, dans l'ordre de
> première apparition : `500 — Ouvrages : ……… %`. Le séparateur est un tiret cadratin entouré d'espaces ; les pointillés
> sont ceux des autres jetons (`………`, trois caractères). Sans intitulé de série, la ligne est `500 : ……… %`. Les lignes
> sont séparées par de vrais sauts de ligne en Word.
> **H4, mieux que demandé :**
> - si tous les lots ont les mêmes séries (le MEN), le jeton donne une seule liste ;
> - sinon, une liste par lot, chacune précédée de « Lot n : » ;
> - un document établi par lot lit la liste de son lot.
>
> Sans DQE, le jeton s'imprime en pointillés. **`B08-MR-06` est désactivé** (ses valeurs restent lisibles : 3 sur
> DBPRS20). ⚠️ **Jusqu'à la recopie du CCAP-T sur `{{BESOIN.series}}`, l'article 16 imprime des pointillés à la place du
> découpage.** Pour le remplacer, une ligne `PARA<tab>{{BESOIN.series}}` suffit, au même endroit que `{{B08-MR-06}}`.

### B1.6 — Ce que le front fait de son côté

- La grille du besoin (`FicheBesoin`) s'adapte aux travaux : colonnes n° de prix, unité, quantité ; série en
  intertitre ; sous-détail et plafond dans le détail de l'article.
- Un bouton « **Coller depuis le tableur** » (Q2) : la PRMP colle des lignes copiées d'Excel (n°, désignation, unité,
  quantité, séparées par des tabulations). L'écran les reconnaît, montre un aperçu, puis les ajoute au lot. Rien n'est
  envoyé avant « Enregistrer ». Les séries se déduisent des lignes d'intertitre (n° sans unité ni quantité, comme
  « 500 OUVRAGES »).
- Développé contre ce contrat avec un repli « contrat en attente » tant que `PUT` répond `BESOIN_HORS_PERIMETRE`, comme
  au lot 1 du DAO.

---

## B2 — Des seuils de qualification calculés (DPAO-T, clause 6.3)

Le DPAO-T imprime des seuils **fixes**. Le DAO du MTP en exige trois **calculés**, ce que la correspondance du
02/10 a relevé comme contradictions (⚠).

### B2.1 — Liquidité : un montant **ou** un pourcentage de l'offre

- Existant : `B03-QT-14` (MONTANT, par lot) — MEN : 99 000 000 Ar au lot 1.
- MTP : « liquidité ou ligne de crédit bancaire ≥ **10 % du montant de l'offre** ».
- **Demandé** : un champ `POURCENTAGE` facultatif, par lot (proposé : `B03-QT-15` « Liquidité minimale en
  pourcentage du montant de l'offre »).
- Règle de bilan **bloquante** `LIQUIDITE_DOUBLE` : `B03-QT-14` et `B03-QT-15` ne peuvent pas être tous deux renseignés
  pour un même lot.

> ⚠️ **Livraison backend du 2026-10-02 (§B2.1).** Conforme : **`B03-QT-15`** (POURCENTAGE, par lot, facultatif). La règle
> **`LIQUIDITE_DOUBLE`** est bloquante, avec les rôles `MONTANT` (`B03-QT-14`) et `POURCENTAGE` (`B03-QT-15`), et se juge
> lot par lot.

### B2.2 — Chiffre d'affaires : annuel, **ou** moyenne des meilleures années, dans un domaine

- Existant : `B03-QT-07` (MONTANT), libellé « pour des travaux de construction ».
- MTP : « moyenne des **3 meilleures des 5 dernières années**, en **travaux routiers**, ≥ 5 000 000 000 Ar ».
- **Demandé**, trois champs facultatifs (proposés) :
  - `B03-QT-16` NOMBRE « Nombre de meilleures années retenues » (MTP : 3) ;
  - `B03-QT-17` NOMBRE « Sur les n dernières années » (MTP : 5) ;
  - `B03-QT-18` TEXTE « Domaine du chiffre d'affaires », défaut « travaux de construction » (MTP : « travaux
    routiers »).
- Règle bloquante `CA_MOYENNE` : `B03-QT-16` et `B03-QT-17` vont ensemble, avec `B03-QT-16` ≤ `B03-QT-17`, et seulement si
  `B03-QT-07` est renseigné.
- Le libellé de `B03-QT-07` devient « Chiffre d'affaires minimum exigé (Ariary) ».

> ⚠️ **Livraison backend du 2026-10-02 (§B2.2).** Conforme :
> - **`B03-QT-16`** et **`B03-QT-17`** (NOMBRE), **`B03-QT-18`** (TEXTE, défaut « travaux de construction ») ; aucun n'est
>   par lot ;
> - libellé de `B03-QT-07` : « Chiffre d'affaires minimum exigé (Ariary) » ;
> - **`CA_MOYENNE`**, bloquante, rôles `CA` (`B03-QT-07`), `MEILLEURES` (16) et `ANNEES` (17). Elle refuse : 16 sans 17 ou
>   l'inverse, 16 > 17, ou une moyenne sans chiffre d'affaires renseigné.

### B2.3 — Références : un marché, **ou** un cumul sur quelques marchés

- Existant : `B03-QT-08` (TEXTE_LONG, par lot, ce que le projet comparable doit comprendre) et `B03-QT-12` (période).
- MTP : « **au plus trois** marchés de travaux routiers […] d'un montant **total** ≥ 2 500 000 000 Ar ».
- **Demandé**, deux champs facultatifs (proposés) :
  - `B03-QT-19` NOMBRE « Nombre maximal de marchés cumulables » (MTP : 3) ;
  - `B03-QT-20` MONTANT par lot « Montant cumulé minimum des marchés (Ariary) ».
- Règle bloquante `REFERENCES_CUMUL` : les deux champs vont ensemble.
- `B03-QT-08` reste : il décrit la nature des marchés.

> ⚠️ **Livraison backend du 2026-10-02 (§B2.3).** Conforme : **`B03-QT-19`** (NOMBRE) et **`B03-QT-20`** (MONTANT, par lot,
> montant positif). **`REFERENCES_CUMUL`** est bloquante, rôles `NOMBRE` et `MONTANT` : un nombre sans montant (pour chaque
> lot d'une ligne allotie), ou un montant sans nombre, est refusé.

### B2.4 — L'impression

C'est le front qui rédige les variantes de la clause 6.3 du DPAO-T, dans `scripts/modeles-dao/decrire.mjs`. Elles sont
signalées comme **ajouts** au document type, dans la même forme que le DAO du MTP, et vous les recevrez avec les
modèles :
- f) « … d'un montant minimum de {{B03-QT-15}} % du montant de son offre » ;
- a) « … un chiffre d'affaires annuel moyen, calculé sur les {{B03-QT-16.lettres}} meilleures des {{B03-QT-17.lettres}}
  dernières années, pour des {{B03-QT-18}}, d'un montant équivalant à {{B03-QT-07}} » ;
- b) « … au plus {{B03-QT-19.lettres}} ({{B03-QT-19}}) marchés […] d'un montant cumulé d'au moins {{B03-QT-20.parLot}} ».

Il me faut seulement les codes définitifs. Pour le texte des variantes, je le soumettrai au pilote avant de vous
l'envoyer.

> ⚠️ **Livraison backend du 2026-10-02 (§B2.4).** Les **codes définitifs sont ceux proposés** : `B03-QT-15` à `B03-QT-20`.
> `.lettres` sur un NOMBRE entier donne déjà « trois », et `.parLot` vaut pour `B03-QT-20`. J'attends les variantes de la
> clause 6.3 avec les modèles.

---

## Hypothèses (à confirmer ou corriger)

- **H1** — `quantite` accepte deux décimales (B1.2).
- **H2** — `numeroPrix` est unique **dans le lot**, pas dans la fiche (le MEN répète le même DQE aux deux lots).
- **H3** — Un article de travaux sans caractéristique est complet (B1.4).
- **H4** — `{{BESOIN.series}}` se lit au lot 1 sur une ligne allotie, faute de mieux (B1.5).

**Recette attendue** :
- **MEN** : le DQE du lot 1 (57 articles, 12 séries) saisi sur une fiche de travaux, recopié au lot 2. Classeur `BP`
  par lot : sous-totaux et récapitulation justes, seule la colonne des prix ouverte. Le CCAP liste les 12 séries à
  l'article 16.
- **MTP** : prix unitaires, colonne des prix en lettres, plafond de `001` contrôlé en formule, `001` dans la liste
  des sous-détails. Le DPAO imprime la liquidité à 10 %, le chiffre d'affaires « 3 meilleures des 5 dernières années
  en travaux routiers », et les références « au plus trois marchés, cumul ≥ 2,5 Md ».

> ⚠️ **Livraison backend du 2026-10-02 — hypothèses et recette.**
> - Réponses : **H1** oui (deux décimales) ; **H2** oui (unique dans le lot) ; **H3** oui ; **H4** voir l'encadré §B1.5
>   (liste unique si les lots ont le même DQE).
> - **Recette** (`FicheDaoTravauxIntegrationTest`) :
>   - **MTP**, prix unitaires, non alloti : 400 nominatifs (numéro manquant, en double, série à deux intitulés,
>     `10.125`, plafond 120) ; DQE de 3 séries, `2054.5` m³, intitulé recopié. Le classeur `BP` a les colonnes des
>     lettres, seules les cellules du candidat sont ouvertes ; prix posés, sous-totaux et total HT sont justes. Le plafond
>     de `001` dit « dépassé » à 9 M sur 75,3 M, et « respecté » à 5 M. Feuille des sous-détails avec `001`. Ni LF ni TC.
>   - **MEN**, forfait, deux lots : `BESOIN_INCOMPLET` sur le lot vide et la quantité nulle, puis le même DQE au lot 2.
>     Un `BP` par lot, sans colonne des lettres ; la révision copie le DQE.
>   - Seuils : liquidité double, moyenne incomplète et cumul sans montant sont bloquants. Une fois complétés (10 %,
>     « 3 meilleures des 5 », 2,5 Md), la fiche se valide.
>   - `SeriesDuBesoinTest` : le jeton, non alloti, alloti identique, alloti différent, document par lot, sans DQE.
>   - Le texte imprimé par le DPAO attend vos variantes de la clause 6.3. Les 57 articles réels du MEN restent à saisir
>     par la recette front.
> - **Livraison** : migration **V59** (DQE, bloc `B12` ouvert aux travaux) et script
>   `docs/referentiel/2026-10-02-dqe-et-seuils-travaux.sql`, passé à blanc sur DBPRS20. Les deux copies du fichier de
>   correspondance des travaux sont mises à jour à l'identique.

> ✅ **Front, 2026-10-03.**
> - **§B1.5, CCAP-T recopié** (`scripts/modeles-dao/modeles/CCAP-T.txt` et `.json`) : la ligne `{{B08-MR-06}}` de
>   l'article 16 devient `{{BESOIN.series}}`, et rien d'autre ne change. `verifier.mjs` donne 573 sur 573. **À recopier.**
> - **§B2.4, variantes de la clause 6.3 du DPAO-T** : rédigées dans `DPAO-T.txt` / `.json` (`verifier.mjs` : 273 sur
>   273). ⚠️ **Ne pas les recopier encore** : elles attendent la validation du pilote. Je vous le dirai ici. Quatre
>   conditions :
>   - `CHIFFRE-AFFAIRES` devient `B03-QT-07 renseigne et B03-QT-16 vide` ;
>   - `CA-MOYENNE` = `B03-QT-07 renseigne et B03-QT-16 renseigne` ;
>   - `REFERENCES-UN` = `B03-QT-19 vide` ; `REFERENCES-CUMUL` = `B03-QT-19 renseigne` ;
>   - `LIQUIDITE-POURCENT` = `B03-QT-15 renseigne`.
>
>   La rédaction d'origine du chiffre d'affaires imprime désormais le domaine : « pour des {{B03-QT-18}} ». Avec la
>   valeur par défaut, le texte reste celui du document type.
> - **Banc de l'import** : aucune fausse valeur sur les deux modèles. Le DPAO-T relit 6 champs de plus (les seuils). Le
>   CCAP-T bouge de quelques champs dans les deux sens : les valeurs fictives du banc sont tirées en séquence, et un
>   champ en moins (`B08-MR-06`) décale tout le tirage.
> - **Écran** : la grille du DQE est développée (n° de prix, séries, coller depuis le tableur) ; lecture vérifiée sur
>   la fiche 31. La recette avec saisie attend l'accord du pilote pour écrire en base.
>
> ✅ **2026-10-03 — variantes de la clause 6.3 validées par le pilote.** `DPAO-T.txt` et `.json` sont **à recopier**
> tels que commités en `6118791`. Rendu attendu avec les valeurs du MTP :
> - « a) avoir réalisé un chiffre d'affaires annuel moyen, calculé sur les trois (3) meilleures des cinq (5) dernières
>   années, pour des travaux routiers, d'un montant équivalant à 5 000 000 000 Ariary » ;
> - « b) […] au cours des dix (10) dernières années, au plus trois (3) marchés de nature et de complexité comparables à
>   celles des Travaux, d'un montant cumulé d'au moins 2 500 000 000 Ariary, et comprenant : » ;
> - « (f) […] d'un montant minimum égal à 10 % du montant de son offre ».
>
> ✅ **Contre-recette du front, 2026-10-03, fiche 32** (travaux, non allotie, jeu du MEN avec les seuils du MTP ;
> écriture en base avec l'accord du pilote) :
> - **Écran** : DQE du MTP collé depuis le tableur, soit 17 articles reconnus et 3 lignes écartées (en-tête, sous-total,
>   total). 3 séries reconnues. Pour `001` : sous-détail coché et plafond 10 % ; libellé du bordereau proposé « Le
>   forfait ». « Enregistrer le besoin » → `PUT` 200. Relu : `2054.5`, `m³`, « Le mètre cube », `sousDetail`, `plafond`.
> - **Seuils** : `B03-QT-15` = 10, `B03-QT-07` = 5 Md avec 3 sur 5 en « travaux routiers », `B03-QT-19` = 3 et
>   `B03-QT-20` = 2,5 Md ; **0 bloquant**.
> - **v1, prix unitaires**, classeur `BP` :
>   - colonnes « Libellé du bordereau » (« Le mètre cube à : ») et « Prix unitaire en toutes lettres » ;
>   - 3 intertitres et 3 sous-totaux ; récapitulation, TVA 20 % et TTC en formules ;
>   - ligne « 001 : 10 % au plus du montant des travaux — respecté / dépassé » ;
>   - seules les colonnes F (lettres) et G (prix HT) sont ouvertes ; feuille « Prix soumis à sous-détail » avec `001`.
> - **v2, révisée au forfait** : DQE recopié (17 articles) ; `BP` sans colonne des lettres, seule la colonne des prix
>   ouverte.
> - **Attendu jusqu'à vos recopies** : l'article 16 du CCAP imprime encore « ……… » (le CCAP-T sur `{{BESOIN.series}}`
>   n'est pas recopié), et la clause 6.3 du DPAO garde la rédaction d'origine (variantes validées, à recopier). La
>   liquidité saisie en pourcentage n'y figure donc pas encore. **Je referai ces deux points après vos recopies.**
> - **Petit constat** : l'en-tête du classeur dit « Dossier d'appel d'offres : 00004/PPM-AGPM/CNM/2026 », qui est la
>   référence du **plan de passation**. Le numéro du DAO est `B02-OB-03` (« 001-DAOO/MEN/PRMP/Tvx-PI-2026 » sur cette
>   fiche). Merci de le corriger, ou de libeller la ligne « Plan de passation ».
> - **Corrigé côté front pendant la recette** : le bouton qui ouvre le détail d'un article se plaçait à côté du champ
>   « Désignation » et passait sous le champ « Unité », qui captait le clic. Il passe désormais sous la désignation.

> ⚠️ **Livraison backend du 2026-10-03 — recopies et en-tête des classeurs.**
> - **CCAP-T et DPAO-T recopiés** tels que commités en `6118791` (`.txt` ; le serveur ne lit pas les `.json`).
>   L'article 16 imprime `{{BESOIN.series}}`. Le DPAO-T compte 45 conditions déclarées (41 auparavant).
> - `verifier.mjs` sur le rendu brut du serveur : CCAP-T 573/573, DPAO-T 273/273.
> - **Rendu** (`ModelesDaoTravauxTest.seuilsCalculesDuDpao`), avec les valeurs du MTP : les trois phrases attendues, à
>   l'identique, y compris « au cours des dix (10) dernières années ».
> - **Sans les seuils calculés**, la rédaction d'origine : « pour des travaux de construction », « au moins un projet »,
>   « un montant minimum de : … ».
> - Le découpage du forfait au CCAP-T est vérifié sur les séries du DQE (`blancsDeB3Remplis`).
> - **Petit constat corrigé**, pour tous les classeurs (`BP` et `TC`, toutes catégories). La deuxième ligne de l'en-tête
>   devient « Dossier d'appel d'offres : 001-DAOO/MEN/PRMP/Tvx-PI-2026 (plan de passation : 00004/PPM-AGPM/CNM/2026) ».
>   Sans numéro de DAO saisi, elle affiche « Plan de passation : 00004/PPM-AGPM/CNM/2026 ». La mise en page ne bouge pas.
> - Ni migration ni script. Les documents des fiches déjà validées restent ceux de leur version : il faut une révision
>   pour les régénérer, la fiche 32 comprise.

> ✅ **Contre-recette du front, 2026-10-03 (JAR de 05:16) : fiche 32 révisée, validée en v3 (forfait).**
> - **CCAP, article 16** : « 000 — INSTALLATION : ……… % », « 500 — OUVRAGES : ……… % », « 600 — CHAUSSEES : ……… % »,
>   puis « - Total… 100 % ».
> - **DPAO, clause 6.3** : les trois variantes validées, à l'identique du rendu attendu (CA moyen « trois (3) meilleures
>   des cinq (5) dernières années, pour des travaux routiers » ; « au plus trois (3) marchés […] cumulé d'au moins
>   2 500 000 000 Ariary » ; liquidité « égal à 10 % du montant de son offre »).
> - **Classeur `BP`** : « Dossier d'appel d'offres : 001-DAOO/MEN/PRMP/Tvx-PI-2026 (plan de passation :
>   00004/PPM-AGPM/CNM/2026) ».
>
> **Demande close.** Reste hors de ce lot : la saisie des 57 articles réels du MEN (2 lots), qui sera faite si une
> recette alloti est utile.
