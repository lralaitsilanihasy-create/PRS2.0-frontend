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

### B1.4 — Les contrôles

- **`BESOIN_INCOMPLET` aux travaux** (bloquant) : chaque lot a au moins un article, et chaque article a un numéro de
  prix, une série, une unité et une quantité positive. **La caractéristique exigée n'est pas demandée** aux travaux : le
  DQE n'en a pas, et les spécifications techniques sont une pièce à part. Les caractéristiques restent possibles, sans
  être exigées.
- **Pas de contrôle de plafond** à la fiche : les prix n'y sont pas.

### B1.5 — Le découpage du forfait, dérivé des séries (Q3)

Aujourd'hui, `B08-MR-06` (TEXTE_LONG, « un poste par ligne, avec son pourcentage ») s'imprime au CCAP-T, article 16.
Les pourcentages sont ceux du **candidat** : le MEN les laisse en blanc (fiche des faits, `B08-RE-01`).

**Demandé** :
- un jeton **`{{BESOIN.series}}`**, une ligne par série du lot : « `500` — Ouvrages : …… % » ;
- en marché non alloti, les séries de l'unique besoin ; en alloti, celles du lot 1, ou une liste par lot si
  l'article 16 se lit par lot (à vous de dire) ;
- **`B08-MR-06` désactivé pour les travaux.** Je recopierai le CCAP-T sur le nouveau jeton dès que vous me direz sa
  forme.

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

### B2.3 — Références : un marché, **ou** un cumul sur quelques marchés

- Existant : `B03-QT-08` (TEXTE_LONG, par lot, ce que le projet comparable doit comprendre) et `B03-QT-12` (période).
- MTP : « **au plus trois** marchés de travaux routiers […] d'un montant **total** ≥ 2 500 000 000 Ar ».
- **Demandé**, deux champs facultatifs (proposés) :
  - `B03-QT-19` NOMBRE « Nombre maximal de marchés cumulables » (MTP : 3) ;
  - `B03-QT-20` MONTANT par lot « Montant cumulé minimum des marchés (Ariary) ».
- Règle bloquante `REFERENCES_CUMUL` : les deux champs vont ensemble.
- `B03-QT-08` reste : il décrit la nature des marchés.

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
