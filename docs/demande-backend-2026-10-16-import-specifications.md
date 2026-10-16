# Demande backend — 2026-10-16 — l'import du DAO lit aussi les articles et leurs spécifications

## Contexte

L'import du DAO (`POST /api/fiches-marche/{idDmc}/import`, lecture seule, puis `PUT …/import/appliquer`) remplit les
**champs** de la fiche. Il ne remplit pas le **besoin** (bloc `B12`, ressource `GET|PUT …/articles`) : après l'import,
la PRMP ressaisit à la main chaque article, son unité, ses quantités et ses caractéristiques techniques. Le pilote l'a
relevé le 16/10 sur la fiche DAO : « Pourquoi les spécifications techniques restent à saisir après l'import ? »

La raison est structurelle. La lecture par modèle inversé trouve des **valeurs** entre des textes fixes ; les articles sont
dans des **tableaux** (bordereau des prix, détail quantitatif, spécifications techniques, définition des prix) dont le
texte fixe se réduit aux intitulés de colonnes. Le front a donc prototypé une seconde lecture, **par les tableaux**, et
l'a mesurée sur cinq DAO réels avant de rien demander.

## La mesure

Prototype : `scripts/import-dao/PdfGrille.java` (mots positionnés et filets du PDF) et `scripts/import-dao/lire-specs.mjs`
(cellules → tableaux → articles). Sortie de référence de chaque DAO : `scripts/import-dao/attendus-articles/*.json`.

| DAO | Nature | Articles | Justes | Spécifications rattachées | Écarts signalés |
|---|---|---|---|---|---|
| 2463 MESupReS — matériel informatique | fournitures, 4 lots, à commande (min/max) | 12 | 12 | 12 | 0 |
| 297 Paositra — matériel informatique | fournitures, 16 lots, quantité fixe | 19 | 19 | 19 | 0 |
| 6114 MEF — produits d'entretien | contrat-cadre, lot unique | 40 | 40 | 40 | 2, réels |
| Ankily-Mahasoa MTP — entretien routier | travaux, DQE | 17 | 17 | 17 (définition des prix) | 1, réel |
| 6213 MEF — entretien de véhicules | contrat-cadre de services | 48 | 48 | 48 | 0 |

- **Articles** (désignation, unité, quantité ou min/max, n° de prix et série pour les travaux) : 136 sur 136.
- **Écarts réels** : le DAO lui-même se contredit entre son bordereau et ses spécifications — « Bombe air comprimé
  **500ml** » / « **100ml** », « Crème à récurer **1l** » / « **950cl** » (6114), « Béton **B2** dosé à 250 kg » /
  « Béton **B1** » (MTP, le CPS donne B1 = 250 kg). Aucune fausse alerte.
- **Caractéristiques** : le texte est toujours entier, son découpage en lignes « libellé / exigence » est imparfait (une
  cellule qui mêle prose et énumération donne des morceaux collés). D'où la confiance **moyenne** demandée en B1.
- Chaque DAO a demandé un ou deux ajustements, aucun n'a fait régresser les précédents : les règles de B3 sont celles
  qui restent après les cinq.

## B1 — `POST …/import` rend aussi les articles lus

Lecture seule, comme le reste de l'import. Nouveau champ de `ImportDaoResult` :

```jsonc
"articles": [
  {
    "lot": 3,                          // rang du lot au plan ; null sur une ligne non allotie
    "numero": "01",                    // tel qu'écrit dans le DAO (« 001 », « 529 ») ; numeroPrix pour les travaux
    "designation": "Bombe air comprimé 500ml",
    "unite": "Unité",
    "quantite": 1,                     // ou quantiteMin / quantiteMax quand le bordereau porte min et max
    "quantiteMin": null,
    "quantiteMax": null,
    "serie": null,                     // travaux : « 500 » …
    "serieLibelle": null,              // … « OUVRAGES »
    "caracteristiques": [ { "libelle": "Mémoire vive", "exigence": "8 Go au minimum" } ],
    "confiance": { "article": "haute", "caracteristiques": "moyenne" },
    "pages": { "bordereau": 24, "specification": 27 },
    "designationSpecification": "Bombe air comprimé 100ml",   // présent seulement en cas d'écart (B5)
    "anomalies": []                    // la ligne ne peut pas être retenue (B5) ; même sens que pour les propositions
  }
]
```

- **Confiance haute** pour désignation, unité, quantités, n° de prix et série : chaque valeur est bornée par sa cellule
  et sa colonne nommée. **Moyenne** pour les caractéristiques (découpage) et pour une définition de prix de travaux.
- Les prix ne sont jamais lus : un DAO n'en porte pas.

## B2 — Écrire : par la ressource existante, sans nouvelle route

Le front propose les articles lus, lot par lot, dans l'écran d'import ; la PRMP coche les lots à reprendre. À
l'application, le front écrit par **`PUT …/articles`** (la liste complète) : il garde tels quels les lots non cochés et
remplace les lots cochés par les articles lus. Rien à ajouter à `…/import/appliquer`.

Question au backend : faut-il garder la **trace** de l'import (fichier, empreinte) sur les articles, comme
`…/import/appliquer` la garde pour les champs ? Si oui, deux champs facultatifs dans le corps de `PUT …/articles`
(`importFichier`, `importEmpreinte`) suffiraient ; sinon le front n'envoie rien de plus.

## B3 — Les règles de lecture (à porter depuis `lire-specs.mjs`)

Même principe que `LecturePdf` (ADR-0012) : le portage tel quel du prototype, contre le jeu de référence.

1. **Grille** : mots avec leur position ; filets = traits et rectangles minces **tracés** ; un rectangle **rempli** (fond
   d'en-tête ombré) n'est pas un filet ; filigrane incliné écarté. Les segments verticaux alignés et contigus sont
   **recollés** : Word trace souvent les filets case par case (DQE MTP, sans quoi aucune ligne d'en-tête n'existe).
2. **Cellules** : une ligne de tableau n'est coupée que là où un filet vertical la traverse réellement (cellules
   fusionnées) ; des fragments à moins d'un point d'écart forment un seul mot.
3. **Tableaux reconnus par leurs intitulés de colonnes** (une ou deux lignes d'en-tête) :
   - *bordereau* : une colonne `DESIGNATION|DESCRIPTION`, une colonne `UNITE` (hors « prix unitaire »), une colonne
     `QUANTITE|QTE` ou `MIN`/`MAX` ;
   - *spécifications* : `DESIGNATION` et une colonne `SPECIFICATION`, ou `DESCRIPTION … DEMANDEE|MINIMUM|REQUIS`
     (6213 : « Description des prestations minimum demandées ») ; la colonne « proposée par le candidat » est écartée ;
   - *définition des prix* (travaux) : des cellules « Prix N° 520 » ; la description suit la désignation dans la cellule et
     sur les lignes suivantes ; « Prix N° » et son numéro coupés par un filet sont recollés (prix 621).
4. **Lot** : « LOT N°3 : », « Lot 3 : », « lot12: » dans les 70 points au-dessus du tableau ; à défaut, le dernier lot vu.
5. **Suite de tableau** : un tableau sans en-tête, aux mêmes colonnes (à 3 points), sur la page suivante, numéroté dès
   sa première ligne — ou dès la seconde quand la première est la fin de l'article coupé par le saut de page — reprend
   le type, les colonnes, le lot ; la fin d'article coupée complète le dernier article (6114, 6213).
6. **Ligne d'article** : numéro de 1 à 3 chiffres en première colonne. Sans désignation → tableau **modèle laissé
   vide** (BPU de la lettre d'invitation, liste des fournitures), aucun article. Bordereau sans unité → **ligne de
   section** (« 500 OUVRAGES ») : la série des articles qui suivent.
7. **Désignation** : le suffixe de prix est retiré — « , l'unité à… », « la boite à », « le kilogramme à », « Le forfait
   à… », « (insérer le prix unitaire en lettre)… ».
8. **Quantités** : entiers ou décimales à virgule et espaces (« 2 054,50 ») ; min/max si le bordereau a ces deux
   colonnes, sinon une seule quantité.
9. **Rapprochement** bordereau / spécifications par lot et numéro (« 001 » = « 1 »). En travaux, le DQE porte les
   quantités ; le bordereau des prix unitaires, sans quantité, n'est pas lu.
10. **Caractéristiques** : texte « d'un seul tenant » (lignes pleines jusqu'au bord de la cellule) découpé sur `;`, `+`
    et les virgules ; sinon une caractéristique par ligne, une ligne prolongeant la précédente si celle-ci finit par
    `, - : / +` ou un mot-outil (de, à, et, avec…) ou si elle est un seul mot à chiffre (« C/RJ45 », « 1080Ti ») ; un
    `;` sépare toujours, sauf devant un nombre (« 0,06 mm min. ; 0,254 mm Max »). « Libellé : valeur » donne libellé et
    exigence. Définition de prix : découpage sur les puces `•`.
11. **Écart de désignation** (B5) si les **nombres** diffèrent (500ml / 100ml, B2 / B1), ou si plus de la moitié des mots
    significatifs manquent **dans les deux sens** — « Fourniture et pose transmission AV. G/D » / « Transmission AV. G/D »
    et les abréviations du DQE (« Couche de roulement en MS ») ne sont pas des écarts.

## B4 — Le Word : les tableaux sont déjà des tableaux

Pour un `.docx`, la géométrie (règles 1, 2, 5) est inutile : les tableaux natifs portent leurs cellules (cellules
fusionnées comprises) et un tableau ne se coupe pas d'une page à l'autre. Les règles 3, 4 et 6 à 11 s'appliquent telles
quelles. Le front n'a pas de DAO Word réel à tableaux pour le mesurer : à vérifier sur ceux produits par l'application.

## B5 — Anomalies et avertissements

- **Anomalies** (l'article ne peut pas être retenu) :
  - `LOT_HORS_PLAN` : le lot lu n'existe pas au plan — le plan fait foi, comme pour les divergences des champs ;
  - `QUANTITES_INCOMPATIBLES` : min/max lus sur une fiche à quantité fixe ou contrat-cadre, ou une seule quantité sur une
    fiche à commande (`ArticleFiche` : à commande = min/max, sinon `quantite`).
- **Avertissements** (dans `avertissements`, l'article reste proposable) :
  - écart de désignation entre bordereau et spécifications (règle 11), avec les deux textes ;
  - article du bordereau sans spécification, ou spécification sans article du bordereau ;
  - contrat-cadre : quantités du bordereau « à titre indicatif » (6114, 6213 portent 1 partout).

## Hypothèses à confirmer

- **H1** — Un DAO non alloti (pas de « Lot n : ») dont la ligne du plan n'a qu'un lot : les articles vont à ce lot.
- **H2** — Une caractéristique sans « libellé : » (« De bonne qualité ») : texte entier en `libelle`, `exigence` vide.
  Si la validation de la fiche exige une exigence non vide, dire laquelle des deux colonnes le serveur préfère remplir.
- **H3** — En travaux, la définition du prix (« Ce prix rémunère au mètre cube… ») est proposée comme caractéristiques
  de l'article, faute de colonne dédiée. Les exigences de matériaux du CPS (CBR, dosages, normes), rédigées par
  matériau et non par prix, ne sont pas lues.

## Limites assumées

Tableaux quadrillés seulement (un bordereau sans filets ne sera pas reconnu) ; pas d'OCR (un PDF scanné reste refusé,
422 existant) ; le libellé du bordereau des travaux (« Le mètre cube ») n'est pas lu.

## Recette proposée

Les cinq DAO de la mesure (fichiers du pilote, non versionnés ; le front les transmet sur demande) : la sortie du
serveur doit égaler `scripts/import-dao/attendus-articles/*.json` sur `lot`, `numero`, `designation`, `unite`,
quantités, `serie`, et le nombre de caractéristiques, plus les trois écarts réels et aucun autre.
